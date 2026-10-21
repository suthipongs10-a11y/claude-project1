import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { studioClient } from './mcpClient.js';
import { makeClip } from './clips.js';
import { fixNotesFromReasons } from '../src/services/qc.js';
import { QcResult } from '@series-studio/core';
import { bible as fixtureBible, outline as fixtureOutline, script as fixtureScript, shots as fixtureShots } from '../../../packages/core/test/fixtures.js';

/**
 * M3 acceptance: run QC on an episode with planted defects, get a report, catch the broken shots,
 * review with keyframes, regen within quota, approve G3.
 * Batches of the fixture episode: b01 = s001(3s)+s002(4s), b02 = s003(3.5)+s004(3), b03 = s005(3.5)+s006(3).
 */
describe('M3 demo: QC, keyframes, review, regen loop, G3', () => {
  let s: Awaited<ReturnType<typeof studioClient>>;
  const SID = 'cafe-secret';
  const file = (...p: string[]) => join(s.t.ctx.store.seriesDir(SID), ...p);
  const strip = <T extends { refs?: unknown; locked?: unknown; ref_version?: unknown; flow_character_id?: unknown }>(e: T) => {
    const { refs: _r, locked: _l, ref_version: _v, flow_character_id: _f, ...rest } = e;
    return rest;
  };

  beforeAll(async () => {
    s = await studioClient();
    expect((await s.call('create_series', { id: SID, title: 'Cafe Secret', logline: 'x', style_id: 'live_kdrama_dub', aspect: '9:16', episodes: 1, ep_length_sec: 20 })).isError).toBe(false);
    expect((await s.call('write_bible', { series_id: SID, story_md: '# story', characters: fixtureBible.characters.map(strip), locations: fixtureBible.locations.map(strip), props: fixtureBible.props.map(strip) })).isError).toBe(false);
    expect((await s.call('write_outline', { series_id: SID, ...fixtureOutline })).isError).toBe(false);
    expect((await s.call('approve_gate', { series_id: SID, gate: 'G1' })).isError).toBe(false);
    const png = join(s.t.root, 'ref.png');
    writeFileSync(png, 'png');
    for (const [type, id] of [['character', 'mina'], ['character', 'tan'], ['location', 'cafe'], ['prop', 'letter']] as const) {
      await s.call('import_refs', { series_id: SID, entity_type: type, entity_id: id, files: [png] });
      await s.call('lock_asset', { series_id: SID, entity_type: type, entity_id: id });
    }
    expect((await s.call('approve_gate', { series_id: SID, gate: 'G2' })).isError).toBe(false);
    expect((await s.call('write_script', { series_id: SID, ...fixtureScript })).isError).toBe(false);
    expect((await s.call('write_shots', { series_id: SID, ...fixtureShots })).isError).toBe(false);
    expect((await s.call('compile_prompts', { series_id: SID, episode: 1 })).isError).toBe(false);
    expect((await s.call('generate', { series_id: SID, episode: 1, quality: 'draft' })).isError).toBe(false);
    // planted defects: b01 good; b02 has a black hole inside s004; b03 is too short (4s instead of 6.5s)
    const dl = join(s.t.root, 'dl');
    mkdirSync(dl);
    makeClip(join(dl, 'b01.mp4'), [['a', 3], ['b', 4]]);
    makeClip(join(dl, 'b02.mp4'), [['a', 3.5], ['b', 1], ['black', 1], ['b', 1]]);
    makeClip(join(dl, 'b03.mp4'), [['a', 2], ['b', 2]]);
    const imp = await s.call('import_clips', { series_id: SID, episode: 1, folder: dl });
    expect(imp.isError, imp.text).toBe(false);
  }, 120_000);
  afterAll(async () => {
    await s.close();
  });

  it('run_qc reports per shot and catches the planted defects', async () => {
    const r = await s.call<{ summary: { shots: number; pass: number; fail: number }; results: Array<{ shot_id: string; pass: boolean; reasons: string[]; checks: Array<{ name: string; pass: boolean; skipped: boolean }> }>; skipped_checks: string[] }>('run_qc', { series_id: SID, episode: 1 });
    expect(r.isError, r.text).toBe(false);
    expect(r.data.summary.shots).toBe(6);
    const by = Object.fromEntries(r.data.results.map((x) => [x.shot_id, x]));
    expect(by['ep01_s001']?.pass).toBe(true);
    expect(by['ep01_s002']?.pass).toBe(true);
    // b02: the black insert adds cuts (clip-level check fails for both shots) and black is only inside s004's window
    expect(by['ep01_s003']?.pass).toBe(false);
    expect(by['ep01_s003']?.checks.find((c) => c.name === 'cuts')?.pass).toBe(false);
    expect(by['ep01_s003']?.checks.find((c) => c.name === 'black')?.pass).toBe(true);
    expect(by['ep01_s004']?.pass).toBe(false);
    expect(by['ep01_s004']?.checks.find((c) => c.name === 'black')?.pass).toBe(false);
    expect(by['ep01_s005']?.pass).toBe(false);
    expect(by['ep01_s005']?.checks.find((c) => c.name === 'duration')?.pass).toBe(false);
    expect(by['ep01_s006']?.pass).toBe(false);
    // dub preset -> dialogue skipped; identity skipped without insightface
    expect(r.data.skipped_checks).toContain('dialogue');
    expect(existsSync(file('episodes/ep01/qc/ep01_s004.json'))).toBe(true);
    const saved = QcResult.parse(JSON.parse(readFileSync(file('episodes/ep01/qc/ep01_s004.json'), 'utf8')));
    expect(saved.version).toBe(1);
    expect(JSON.parse(readFileSync(file('episodes/ep01/state.json'), 'utf8')).status).toBe('qc');
    // ≥ 80% of planted defects caught: black (s004) + short (b03 -> s005, s006) = 3/3
    expect(['ep01_s004', 'ep01_s005', 'ep01_s006'].filter((id) => !by[id]!.pass).length / 3).toBeGreaterThanOrEqual(0.8);
  }, 120_000);

  it('run_qc with auto_regen queues regen for failed batches within quota', async () => {
    // b03 (s005/s006) has 1 attempt so far and no review yet -> auto regen allowed
    const r = await s.call<{ regen: Array<{ shot_id: string; job_id?: string; skipped_reason?: string }> }>('run_qc', { series_id: SID, episode: 1, shot_ids: ['ep01_s005'], auto_regen: true });
    expect(r.isError, r.text).toBe(false);
    expect(r.data.regen.length).toBe(1);
    expect(r.data.regen[0]?.job_id).toBeTruthy();
    const job = s.t.ctx.jobs.get(r.data.regen[0]!.job_id!)!;
    expect(job.attempt).toBe(2);
    expect(job.fix_notes).toContain('match the total duration exactly');
  }, 120_000);

  it('get_keyframes returns images and review_shot records a verdict', async () => {
    const res = await s.client.callTool({ name: 'get_keyframes', arguments: { series_id: SID, episode: 1, shot_id: 'ep01_s004' } });
    expect(res.isError).toBeFalsy();
    const images = (res.content as Array<{ type: string; data?: string; mimeType?: string }>).filter((c) => c.type === 'image');
    expect(images.length).toBe(3);
    expect(images[0]?.mimeType).toBe('image/jpeg');
    expect(Buffer.from(images[0]!.data!, 'base64').subarray(0, 2).toString('hex')).toBe('ffd8'); // JPEG magic
    const sc = res.structuredContent as { frames: string[]; qc: { pass: boolean } };
    expect(sc.frames[0]).toMatch(/^episodes\/ep01\/qc\/frames\/ep01_s004_v1_1\.jpg$/);
    expect(sc.qc.pass).toBe(false);

    const rv = await s.call('review_shot', { series_id: SID, episode: 1, shot_id: 'ep01_s006', pass: true, reason: 'ภาพสั้นแต่ใช้ได้ ตัดต่อชดเชยได้', by: 'human' });
    expect(rv.isError, rv.text).toBe(false);
    const saved = QcResult.parse(JSON.parse(readFileSync(file('episodes/ep01/qc/ep01_s006.json'), 'utf8')));
    expect(saved.review).toEqual({ pass: true, reason: 'ภาพสั้นแต่ใช้ได้ ตัดต่อชดเชยได้', by: 'human' });
  }, 60_000);

  it('regen_shot creates attempt 2 with [FIX] notes, bounded by max_regen_attempts', async () => {
    const r = await s.call<{ job_id: string; batch_id: string; attempt: number; shot_ids: string[] }>('regen_shot', { series_id: SID, episode: 1, shot_id: 'ep01_s004', fix_notes: 'no black frames; keep the envelope sharp on the counter' });
    expect(r.isError, r.text).toBe(false);
    expect(r.data).toMatchObject({ batch_id: 'b02', attempt: 2, shot_ids: ['ep01_s003', 'ep01_s004'] });
    const job = s.t.ctx.jobs.get(r.data.job_id)!;
    expect(job.fix_notes).toContain('no black frames');
    expect(job.status).toBe('awaiting_import');
    // quota: original + max_regen_attempts (2) regens; the third regen is refused until a human decides
    const second = await s.call<{ attempt: number }>('regen_shot', { series_id: SID, episode: 1, shot_id: 'ep01_s004', fix_notes: 'y' });
    expect(second.isError, second.text).toBe(false);
    expect(second.data.attempt).toBe(3);
    const third = await s.call('regen_shot', { series_id: SID, episode: 1, shot_id: 'ep01_s004', fix_notes: 'z' });
    expect(third.isError).toBe(true);
    expect(third.text).toContain('รอคนตัดสิน');
    // deterministic fix notes from QC reasons
    const qc = QcResult.parse(JSON.parse(readFileSync(file('episodes/ep01/qc/ep01_s005.json'), 'utf8')));
    expect(fixNotesFromReasons(qc)).toContain('match the total duration exactly');
  });

  it('importing the fixed take and re-running QC flips the shot to pass; G3 then needs every shot green', async () => {
    const dl2 = join(s.t.root, 'dl2');
    mkdirSync(dl2);
    makeClip(join(dl2, 'b02_take2.mp4'), [['a', 3.5], ['b', 3]]);
    const imp = await s.call<{ mapped: Array<{ stored: string }> }>('import_clips', { series_id: SID, episode: 1, files: [join(dl2, 'b02_take2.mp4')] });
    expect(imp.data.mapped[0]?.stored).toBe('episodes/ep01/gen/b02/v2.mp4'); // first awaiting job = attempt 2
    const r = await s.call<{ results: Array<{ shot_id: string; pass: boolean; version: number }> }>('run_qc', { series_id: SID, episode: 1, shot_ids: ['ep01_s003', 'ep01_s004'] });
    expect(r.isError, r.text).toBe(false);
    const s004 = r.data.results.find((x) => x.shot_id === 'ep01_s004')!;
    expect(s004.version).toBe(2);
    expect(s004.pass).toBe(true);

    const g3 = await s.call<{ check: { blockers: string[] } }>('check_gate', { series_id: SID, gate: 'G3', episode: 1 });
    expect(g3.data.check.blockers.join(' ')).toContain('ep01_s005'); // still failing: short clip, no review
    await s.call('review_shot', { series_id: SID, episode: 1, shot_id: 'ep01_s005', pass: true, reason: 'ยอมรับ', by: 'human' });
    const ok = await s.call<{ series_status: string }>('approve_gate', { series_id: SID, gate: 'G3', episode: 1 });
    expect(ok.isError, ok.text).toBe(false);
    expect(JSON.parse(readFileSync(file('episodes/ep01/state.json'), 'utf8')).status).toBe('draft_approved');
    expect(ok.data.series_status).toBe('production');
  }, 120_000);

});
