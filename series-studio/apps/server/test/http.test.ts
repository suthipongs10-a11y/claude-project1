import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createHttpServer } from '../src/http/server.js';
import { makeTempStudio } from './helpers.js';
import { bible as fixtureBible, outline as fixtureOutline, script as fixtureScript, shots as fixtureShots } from '../../../packages/core/test/fixtures.js';
import { SeriesService } from '../src/services/series.js';
import { BibleService } from '../src/services/bible.js';
import { EpisodeService } from '../src/services/episode.js';
import { makeClip } from './clips.js';

/** M5 acceptance (API side): every gate can be approved from the dashboard API with the pairing token. */
describe('HTTP/WS API', () => {
  const t = makeTempStudio({ assembly: { x264_preset: 'ultrafast', crf: 30 } });
  const { app, token } = createHttpServer(t.ctx, { token: 'test-token-1234567890', dashboardDir: join(t.root, 'no-dashboard') });
  const H = { authorization: `Bearer ${token}` };
  const SID = 'cafe-secret';
  const strip = <T extends { refs?: unknown; locked?: unknown; ref_version?: unknown; flow_character_id?: unknown }>(e: T) => {
    const { refs: _r, locked: _l, ref_version: _v, flow_character_id: _f, ...rest } = e;
    return rest;
  };

  beforeAll(async () => {
    await app.ready();
  });
  afterAll(async () => {
    await Promise.race([app.close(), new Promise((r) => setTimeout(r, 5000))]);
    t.cleanup();
  }, 20_000);

  it('requires the token for /api and /files but not for / or /api/health', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/series' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/series', headers: { authorization: 'Bearer wrong' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/series', headers: H })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/api/series?token=${token}` })).statusCode).toBe(200);
    const home = await app.inject({ method: 'GET', url: '/' });
    expect(home.statusCode).toBe(200);
    expect(home.body).toContain('Series Studio');
  });

  it('creates a series through the wizard endpoint and lists styles', async () => {
    const styles = await app.inject({ method: 'GET', url: '/api/styles', headers: H });
    expect(styles.json().styles.length).toBe(11);
    const bad = await app.inject({ method: 'POST', url: '/api/series', headers: H, payload: { title: 'x', logline: 'y', style_id: 'nope', aspect: '9:16', episodes: 1, ep_length_sec: 20 } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error).toContain('ไม่พบสไตล์');
    const r = await app.inject({ method: 'POST', url: '/api/series', headers: H, payload: { id: SID, title: 'Cafe Secret', logline: 'y', style_id: 'live_kdrama_dub', aspect: '9:16', episodes: 1, ep_length_sec: 20 } });
    expect(r.statusCode).toBe(200);
    expect(r.json().series.id).toBe(SID);
    const list = await app.inject({ method: 'GET', url: '/api/series', headers: H });
    expect(list.json().series.map((s: { id: string }) => s.id)).toEqual([SID]);
  });

  it('approves G1 and G2 from the dashboard (via = dashboard), with 409 + blockers when not ready', async () => {
    const early = await app.inject({ method: 'POST', url: `/api/series/${SID}/gates/G1`, headers: H, payload: {} });
    expect(early.statusCode).toBe(409);
    expect(early.json().blockers.length).toBeGreaterThan(0);
    const bible = new BibleService(t.ctx, t.ctx.jobs);
    bible.write(SID, { story_md: '# s', characters: fixtureBible.characters.map(strip), locations: fixtureBible.locations.map(strip), props: fixtureBible.props.map(strip) });
    t.ctx.store.writeJson(new SeriesService(t.ctx).outlineFile(SID, 1), fixtureOutline);
    const check = await app.inject({ method: 'GET', url: `/api/series/${SID}/gates/G1/check`, headers: H });
    expect(check.json().check.ok).toBe(true);
    const g1 = await app.inject({ method: 'POST', url: `/api/series/${SID}/gates/G1`, headers: H, payload: { note: 'จากมือถือ' } });
    expect(g1.statusCode).toBe(200);
    expect(g1.json().series_status).toBe('bible_approved');
    const s = new SeriesService(t.ctx).load(SID);
    expect(s.gates.G1.via).toBe('dashboard');
    expect(s.gates.G1.note).toBe('จากมือถือ');

    const png = join(t.root, 'ref.png');
    writeFileSync(png, 'png');
    for (const [type, id] of [['character', 'mina'], ['character', 'tan'], ['location', 'cafe'], ['prop', 'letter']] as const) {
      bible.importRefs(SID, type, id, [png]);
      const lock = await app.inject({ method: 'POST', url: `/api/series/${SID}/assets/${type}/${id}/lock`, headers: H });
      expect(lock.statusCode, lock.body).toBe(200);
      expect(lock.json().entity.locked).toBe(true);
    }
    const g2 = await app.inject({ method: 'POST', url: `/api/series/${SID}/gates/G2`, headers: H, payload: {} });
    expect(g2.statusCode).toBe(200);
    const summary = await app.inject({ method: 'GET', url: `/api/series/${SID}`, headers: H });
    expect(summary.json().series.status).toBe('assets_locked');
    expect(summary.json().bible.characters.every((c: { locked: boolean }) => c.locked)).toBe(true);
  });

  it('episode endpoint returns shots, qc, gen pointers, frames; review/regen/comments/G3/G4/export work', async () => {
    const episodes = new EpisodeService(t.ctx);
    episodes.writeScript(SID, fixtureScript);
    episodes.writeShots(SID, fixtureShots);
    episodes.compilePrompts(SID, 1);
    await episodes.generate(SID, 1, { quality: 'draft' });
    const dl = join(t.root, 'dl');
    mkdirSync(dl);
    makeClip(join(dl, 'b01.mp4'), [['a', 3], ['b', 4]], true);
    makeClip(join(dl, 'b02.mp4'), [['a', 3.5], ['b', 3]], true);
    makeClip(join(dl, 'b03.mp4'), [['a', 3.5], ['b', 3]], true);
    episodes.importClips(SID, 1, { folder: dl });

    const qc = await app.inject({ method: 'POST', url: `/api/series/${SID}/episodes/1/qc`, headers: H, payload: {} });
    expect(qc.statusCode, qc.body).toBe(200);
    expect(qc.json().summary.shots).toBe(6);

    const ep = await app.inject({ method: 'GET', url: `/api/series/${SID}/episodes/1`, headers: H });
    expect(ep.statusCode).toBe(200);
    const body = ep.json();
    expect(body.shots.shots.length).toBe(6);
    expect(Object.keys(body.qc).length).toBe(6);
    expect(body.gen['ep01_s003'].clip).toBe('episodes/ep01/gen/b02/v1.mp4');
    expect(body.gen['ep01_s003'].frames.length).toBe(3);
    expect(body.jobs.length).toBe(3);

    // media with token in query (for <img>/<video>)
    const img = await app.inject({ method: 'GET', url: `/files/${SID}/${body.gen['ep01_s003'].frames[0]}?token=${token}` });
    expect(img.statusCode).toBe(200);
    expect(img.headers['content-type']).toContain('image/jpeg');
    expect((await app.inject({ method: 'GET', url: `/files/${SID}/../../etc/passwd?token=${token}` })).statusCode).toBeGreaterThanOrEqual(400);

    const review = await app.inject({ method: 'POST', url: `/api/series/${SID}/episodes/1/shots/ep01_s001/review`, headers: H, payload: { pass: true, reason: 'ดูแล้วโอเค' } });
    expect(review.statusCode).toBe(200);
    expect(review.json().result.review.by).toBe('human');
    const regen = await app.inject({ method: 'POST', url: `/api/series/${SID}/episodes/1/shots/ep01_s004/regen`, headers: H, payload: { fix_notes: 'ซองจดหมายไม่ชัด' } });
    expect(regen.statusCode).toBe(200);
    expect(regen.json().attempt).toBe(2);

    const draft = await app.inject({ method: 'POST', url: `/api/series/${SID}/episodes/1/assemble`, headers: H, payload: { quality: 'draft' } });
    expect(draft.statusCode, draft.body).toBe(200);
    const c = await app.inject({ method: 'POST', url: `/api/series/${SID}/episodes/1/comments`, headers: H, payload: { t_sec: 10.0, text: 'หน้ามีนาเพี้ยนตรงนี้' } });
    expect(c.statusCode).toBe(200);
    expect(c.json().comment.shot_id).toBe('ep01_s003'); // t=10 -> title 2s + b01 7s = 9 .. b02 starts, s003 is 9-12.5
    expect(existsSync(t.ctx.store.episodePath(SID, 1, 'edit', 'comments.json'))).toBe(true);

    const g3 = await app.inject({ method: 'POST', url: `/api/series/${SID}/gates/G3`, headers: H, payload: { episode: 1 } });
    expect(g3.statusCode, g3.body).toBe(200);
    const fin = await app.inject({ method: 'POST', url: `/api/series/${SID}/episodes/1/assemble`, headers: H, payload: { quality: 'final' } });
    expect(fin.statusCode, fin.body).toBe(200);
    const g4 = await app.inject({ method: 'POST', url: `/api/series/${SID}/gates/G4`, headers: H, payload: { episode: 1 } });
    expect(g4.statusCode, g4.body).toBe(200);
    const exp = await app.inject({ method: 'POST', url: `/api/series/${SID}/episodes/1/export`, headers: H, payload: { folder: join(t.root, 'out') } });
    expect(exp.statusCode, exp.body).toBe(200);
    expect(exp.json().exported.some((f: string) => f.endsWith('ep01_9x16.mp4'))).toBe(true);
    expect(JSON.parse(readFileSync(t.ctx.store.episodePath(SID, 1, 'state.json'), 'utf8')).status).toBe('exported');
  }, 300_000);

  it('settings PUT writes config/local.json and live-applies thresholds', async () => {
    const before = await app.inject({ method: 'GET', url: '/api/settings', headers: H });
    expect(before.json().effective.qc.cer_max).toBe(0.25);
    const put = await app.inject({ method: 'PUT', url: '/api/settings', headers: H, payload: { qc: { cer_max: 0.3 }, export_dir: join(t.root, 'exports2') } });
    expect(put.statusCode).toBe(200);
    expect(put.json().restart_required).toBe(false);
    const local = JSON.parse(readFileSync(join(t.root, 'config', 'local.json'), 'utf8'));
    expect(local.qc.cer_max).toBe(0.3);
    expect(local.assembly.x264_preset).toBe('ultrafast'); // existing override kept
    expect(t.ctx.config.qc.cer_max).toBe(0.3);
    const bad = await app.inject({ method: 'PUT', url: '/api/settings', headers: H, payload: { default_engine: 'nope' } });
    expect(bad.statusCode).toBe(400);
  });

  it('websocket pushes change events to connected clients', async () => {
    await app.listen({ host: '127.0.0.1', port: 0 });
    const addr = app.server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const denied = new WebSocket(`ws://127.0.0.1:${port}/ws?token=wrong`);
    await new Promise<void>((res) => denied.on('error', () => res()).on('unexpected-response', () => res()).on('close', () => res()));
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${token}&role=dashboard`);
    const messages: Array<Record<string, unknown>> = [];
    await new Promise<void>((res, rej) => {
      ws.on('message', (d) => {
        messages.push(JSON.parse(String(d)));
        if (messages.length >= 2) res();
      });
      ws.on('open', () => t.ctx.emit({ type: 'test_event', series_id: SID }));
      ws.on('error', rej);
    });
    expect(messages[0]?.['kind']).toBe('hello');
    expect(messages[1]).toMatchObject({ kind: 'change', type: 'test_event', series_id: SID });
    denied.terminate();
    await new Promise<void>((res) => {
      ws.on('close', () => res());
      ws.close();
    });
  });
});
