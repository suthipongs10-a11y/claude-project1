import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { studioClient } from './mcpClient.js';
import { bible as fixtureBible, outline as fixtureOutline, script as fixtureScript, shots as fixtureShots } from '../../../packages/core/test/fixtures.js';

/**
 * M2 acceptance: script -> shots -> prompts -> prompt sheet -> (user generates) -> import_clips
 * maps the files onto the right batches/shots.
 */
describe('M2 demo: episode breakdown and manual round-trip', () => {
  let s: Awaited<ReturnType<typeof studioClient>>;
  const SID = 'cafe-secret';
  const file = (...p: string[]) => join(s.t.ctx.store.seriesDir(SID), ...p);
  const strip = <T extends { refs?: unknown; locked?: unknown; ref_version?: unknown; flow_character_id?: unknown }>(e: T) => {
    const { refs: _r, locked: _l, ref_version: _v, flow_character_id: _f, ...rest } = e;
    return rest;
  };

  beforeAll(async () => {
    s = await studioClient();
    // --- M1 steps compressed: series, bible, outlines, G1, refs, locks, G2
    const r = await s.call('create_series', { id: SID, title: 'Cafe Secret', logline: 'x', style_id: 'live_kdrama_dub', aspect: '9:16', episodes: 3, ep_length_sec: 20 });
    expect(r.isError, r.text).toBe(false);
    const wb = await s.call('write_bible', { series_id: SID, story_md: '# story', characters: fixtureBible.characters.map(strip), locations: fixtureBible.locations.map(strip), props: fixtureBible.props.map(strip) });
    expect(wb.isError, wb.text).toBe(false);
    for (const n of [1, 2, 3]) {
      const o = await s.call('write_outline', { series_id: SID, ...fixtureOutline, episode: n });
      expect(o.isError, o.text).toBe(false);
    }
    expect((await s.call('approve_gate', { series_id: SID, gate: 'G1' })).isError).toBe(false);
    const png = join(s.t.root, 'ref.png');
    writeFileSync(png, 'png');
    for (const [type, id] of [['character', 'mina'], ['character', 'tan'], ['location', 'cafe'], ['prop', 'letter']] as const) {
      expect((await s.call('import_refs', { series_id: SID, entity_type: type, entity_id: id, files: [png] })).isError).toBe(false);
      expect((await s.call('lock_asset', { series_id: SID, entity_type: type, entity_id: id })).isError).toBe(false);
    }
    const g2 = await s.call('approve_gate', { series_id: SID, gate: 'G2' });
    expect(g2.isError, g2.text).toBe(false);
  });
  afterAll(async () => {
    await s.close();
  });

  it('write_script stores script.json with timing estimates', async () => {
    const bad = await s.call('write_script', { series_id: SID, ...fixtureScript, lines: [{ id: 'l1', scene: 1, char: 'nobody', text: 'x' }] });
    expect(bad.isError).toBe(true);
    const r = await s.call<{ timing: { syllables: number; est_speech_sec: number } }>('write_script', { series_id: SID, ...fixtureScript });
    expect(r.isError, r.text).toBe(false);
    expect(r.data.timing.syllables).toBeGreaterThan(0);
    expect(existsSync(file('episodes/ep01/script.json'))).toBe(true);
    expect(JSON.parse(readFileSync(file('episodes/ep01/state.json'), 'utf8')).status).toBe('scripted');
  });

  it('write_shots validates and previews batches', async () => {
    const bad = await s.call('write_shots', { series_id: SID, ...fixtureShots, shots: fixtureShots.shots.map((x) => ({ ...x, purpose: x.id === 'ep01_s002' ? ' ' : x.purpose })) });
    expect(bad.isError).toBe(true);
    expect(bad.text).toContain('purpose');
    const r = await s.call<{ batches_preview: Array<{ id: string; shot_ids: string[] }> }>('write_shots', { series_id: SID, ...fixtureShots });
    expect(r.isError, r.text).toBe(false);
    expect(r.data.batches_preview.map((b) => b.id)).toEqual(['b01', 'b02', 'b03']);
    expect(JSON.parse(readFileSync(file('episodes/ep01/state.json'), 'utf8')).status).toBe('shots_ready');
  });

  it('compile_prompts writes batches and assigns shot.batch; requires G2', async () => {
    const r = await s.call<{ batches: Array<{ id: string; prompt: string; ref_images: string[] }> }>('compile_prompts', { series_id: SID, episode: 1 });
    expect(r.isError, r.text).toBe(false);
    expect(r.data.batches.length).toBe(3);
    expect(r.data.batches[1]?.prompt).toContain('[SHOT 1 | 0.0–3.5s | ep01_s003');
    expect(r.data.batches[1]?.ref_images).toEqual(['bible/characters/mina/refs/v1/ref.png', 'bible/locations/cafe/refs/v1/ref.png', 'bible/props/letter/refs/v1/ref.png']);
    expect(existsSync(file('episodes/ep01/batches/b02.json'))).toBe(true);
    const shots = JSON.parse(readFileSync(file('episodes/ep01/shots.json'), 'utf8'));
    expect(shots.shots.map((x: { batch: string }) => x.batch)).toEqual(['b01', 'b01', 'b02', 'b02', 'b03', 'b03']);
    // determinism: compiling again yields identical prompts
    const again = await s.call<{ batches: Array<{ prompt: string }> }>('compile_prompts', { series_id: SID, episode: 1 });
    expect(again.data.batches.map((b) => b.prompt)).toEqual(r.data.batches.map((b) => b.prompt));
    const prompts = await s.client.listPrompts();
    expect(prompts.prompts.map((p) => p.name)).toContain('breakdown_episode');
  });

  it('generate queues manual jobs (awaiting_import) and records cost; export_prompt_sheet writes md+csv', async () => {
    const g = await s.call<{ job_ids: string[]; jobs: Array<{ batch_id: string; status: string }> }>('generate', { series_id: SID, episode: 1, quality: 'draft' });
    expect(g.isError, g.text).toBe(false);
    expect(g.data.jobs.map((j) => j.batch_id)).toEqual(['b01', 'b02', 'b03']);
    expect(g.data.jobs.every((j) => j.status === 'awaiting_import')).toBe(true);
    expect(JSON.parse(readFileSync(file('episodes/ep01/state.json'), 'utf8')).status).toBe('generating');
    const cost = JSON.parse(readFileSync(file('cost.json'), 'utf8'));
    expect(cost.episodes['1'].jobs).toBe(3);
    const sheet = await s.call<{ files: string[] }>('export_prompt_sheet', { series_id: SID, episode: 1 });
    expect(sheet.isError, sheet.text).toBe(false);
    expect(sheet.text).toContain('## b01');
    expect(sheet.text).toContain(g.data.job_ids[0]!);
    expect(existsSync(file('episodes/ep01/edit/prompt_sheet_draft.csv'))).toBe(true);
    const status = await s.call<{ jobs: Array<{ status: string }> }>('job_status', { series_id: SID, episode: 1 });
    expect(status.data.jobs.length).toBe(3);
  });

  it('import_clips maps files by batch id / job id / order and writes gen pointers', async () => {
    const dl = join(s.t.root, 'downloads');
    mkdirSync(dl);
    const jobs = s.t.ctx.jobs.list({ series_id: SID, episode: 1, kind: 'clip' });
    writeFileSync(join(dl, 'flow_b01_final.mp4'), 'clip1');
    const jobB02 = jobs.find((j) => j.batch_id === 'b02')!;
    writeFileSync(join(dl, `${jobB02.id}.mp4`), 'clip2');
    writeFileSync(join(dl, 'random_name.mp4'), 'clip3');
    writeFileSync(join(dl, 'notes.txt'), 'ignored');
    const r = await s.call<{ mapped: Array<{ batch_id: string; how: string; stored: string }>; unmatched: string[]; warnings: string[] }>('import_clips', { series_id: SID, episode: 1, folder: dl });
    expect(r.isError, r.text).toBe(false);
    const byBatch = Object.fromEntries(r.data.mapped.map((m) => [m.batch_id, m]));
    expect(byBatch['b01']?.how).toBe('filename:batch');
    expect(byBatch['b02']?.how).toBe('filename:job');
    expect(byBatch['b03']?.how).toBe('order');
    expect(r.data.unmatched).toEqual([]);
    expect(r.data.warnings.join(' ')).toContain('random_name.mp4');
    expect(existsSync(file('episodes/ep01/gen/b01/v1.mp4'))).toBe(true);
    expect(readFileSync(file('episodes/ep01/gen/b02/v1.mp4'), 'utf8')).toBe('clip2');
    const ptr = JSON.parse(readFileSync(file('episodes/ep01/gen/ep01_s004/v1.json'), 'utf8'));
    expect(ptr).toMatchObject({ clip: 'episodes/ep01/gen/b02/v1.mp4', offset_sec: 3.5, duration_sec: 3 });
    expect(s.t.ctx.jobs.list({ series_id: SID, episode: 1, kind: 'clip' }).every((j) => j.status === 'done')).toBe(true);
    expect(JSON.parse(readFileSync(file('episodes/ep01/state.json'), 'utf8')).status).toBe('qc');

    // a second generate of one batch is attempt 2 and imports to v2 without touching v1
    const g2 = await s.call<{ jobs: Array<{ attempt: number }> }>('generate', { series_id: SID, episode: 1, batch_ids: ['b02'], quality: 'draft', fix_notes: 'keep mole visible' });
    expect(g2.data.jobs[0]?.attempt).toBe(2);
    writeFileSync(join(dl, 'b02-take2.mp4'), 'clip2b');
    const r2 = await s.call<{ mapped: Array<{ stored: string }> }>('import_clips', { series_id: SID, episode: 1, files: [join(dl, 'b02-take2.mp4')] });
    expect(r2.data.mapped[0]?.stored).toBe('episodes/ep01/gen/b02/v2.mp4');
    expect(readFileSync(file('episodes/ep01/gen/b02/v1.mp4'), 'utf8')).toBe('clip2');
  });

  it('resources expose script and shots', async () => {
    const sc = await s.client.readResource({ uri: `series://${SID}/ep/1/script` });
    expect(JSON.parse(sc.contents[0]!.text as string).lines.length).toBe(2);
    const sh = await s.client.readResource({ uri: `series://${SID}/ep/1/shots` });
    expect(JSON.parse(sh.contents[0]!.text as string).shots.length).toBe(6);
  });
});
