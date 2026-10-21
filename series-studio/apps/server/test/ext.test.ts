import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createHttpServer } from '../src/http/server.js';
import { makeTempStudio } from './helpers.js';
import { makeClip } from './clips.js';
import { SeriesService } from '../src/services/series.js';
import { BibleService } from '../src/services/bible.js';
import { EpisodeService } from '../src/services/episode.js';
import { GateService } from '../src/services/gates.js';
import { buildServer } from '../src/server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { bible as fixtureBible, outline as fixtureOutline, script as fixtureScript, shots as fixtureShots } from '../../../packages/core/test/fixtures.js';

/**
 * M6 acceptance (server side): with a paired extension, `generate` on a flow_ext series dispatches
 * one job at a time, the extension uploads the clip, jobs/gen pointers/episode state update, an
 * unknown page halts the queue until resume, and Flow character ids are saved to the bible.
 * The real Flow DOM cannot be driven here: a fake extension plays the WS/HTTP protocol.
 */
describe('flow_ext engine + extension bridge', () => {
  const t = makeTempStudio({ engines: { flow_ext: { minDelayMs: 0, maxDelayMs: 0, jobTimeoutSec: 10 } } });
  const token = 'ext-token-0123456789abcdef';
  const { app } = createHttpServer(t.ctx, { token, dashboardDir: join(t.root, 'none') });
  const SID = 'cafe-secret';
  let base = '';
  let ext: WebSocket;
  const inbox: Array<Record<string, unknown>> = [];
  const strip = <T extends { refs?: unknown; locked?: unknown; ref_version?: unknown; flow_character_id?: unknown }>(e: T) => {
    const { refs: _r, locked: _l, ref_version: _v, flow_character_id: _f, ...rest } = e;
    return rest;
  };
  const waitFor = async (pred: () => boolean, ms = 10_000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (pred()) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('timeout waiting');
  };
  const nextJobMessage = async () => {
    await waitFor(() => inbox.some((m) => m['kind'] === 'job'));
    const i = inbox.findIndex((m) => m['kind'] === 'job');
    return inbox.splice(i, 1)[0] as { job: { id: string; kind: string; prompt: string; ref_urls: string[]; result_url: string; selectors_url: string; delays_ms: { min: number; max: number }; flow_character_ids: string[] } };
  };

  beforeAll(async () => {
    await app.listen({ host: '127.0.0.1', port: 0 });
    const addr = app.server.address();
    base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
    const series = new SeriesService(t.ctx);
    series.create({ id: SID, title: 'Cafe Secret', logline: 'x', style_id: 'live_kdrama_dub', aspect: '9:16', episodes: 1, ep_length_sec: 20, product: null, engine_id: 'flow_ext' });
    const bible = new BibleService(t.ctx, t.ctx.jobs);
    bible.write(SID, { story_md: '# s', characters: fixtureBible.characters.map(strip), locations: fixtureBible.locations.map(strip), props: fixtureBible.props.map(strip) });
    t.ctx.store.writeJson(series.outlineFile(SID, 1), fixtureOutline);
    const png = join(t.root, 'ref.png');
    writeFileSync(png, 'png');
    for (const [type, id] of [['character', 'mina'], ['character', 'tan'], ['location', 'cafe'], ['prop', 'letter']] as const) {
      bible.importRefs(SID, type, id, [png]);
      bible.lock(SID, type, id);
    }
    const gates = new GateService(t.ctx);
    gates.approve(SID, 'G1', {});
    gates.approve(SID, 'G2', {});
    const episodes = new EpisodeService(t.ctx);
    episodes.writeScript(SID, fixtureScript);
    episodes.writeShots(SID, fixtureShots);
    episodes.compilePrompts(SID, 1);
  }, 60_000);
  afterAll(async () => {
    ext?.terminate();
    t.ctx.ext?.close();
    await Promise.race([app.close(), new Promise((r) => setTimeout(r, 5000))]);
    t.cleanup();
  }, 20_000);

  it('queues flow_ext jobs while no extension is connected', async () => {
    const episodes = new EpisodeService(t.ctx);
    const jobs = await episodes.generate(SID, 1, { quality: 'draft' });
    expect(jobs.map((j) => j.status)).toEqual(['queued', 'queued', 'queued']);
    const st = await app.inject({ method: 'GET', url: '/api/ext/status', headers: { authorization: `Bearer ${token}` } });
    expect(st.json()).toMatchObject({ connected: false, active_job: null, queued: 3 });
    const sel = await app.inject({ method: 'GET', url: '/api/ext/selectors', headers: { authorization: `Bearer ${token}` } });
    expect(sel.json().selectors.prompt_textarea).toBeTruthy();
  });

  it('dispatches one job at a time once the extension connects; uploads complete jobs', async () => {
    ext = new WebSocket(`${base.replace('http', 'ws')}/ws?token=${token}&role=extension`);
    ext.on('message', (d) => inbox.push(JSON.parse(String(d))));
    await new Promise<void>((res, rej) => ext.once('open', () => res()).once('error', rej));
    ext.send(JSON.stringify({ kind: 'ext_hello', version: '0.1.0', busy: false }));

    const first = await nextJobMessage();
    expect(first.job.kind).toBe('clip');
    expect(first.job.prompt).toContain('[STYLE]');
    expect(first.job.ref_urls[0]).toContain(`${base}/files/${SID}/bible/characters/`);
    expect(first.job.result_url).toContain(`/api/ext/jobs/${first.job.id}/result?token=`);
    expect(first.job.delays_ms).toEqual({ min: 0, max: 0 });
    // only one job in flight
    expect(inbox.filter((m) => m['kind'] === 'job').length).toBe(0);
    expect(t.ctx.jobs.get(first.job.id)?.status).toBe('running');
    expect(t.ctx.ext?.status()).toMatchObject({ connected: true, active_job: first.job.id, queued: 2 });

    // the extension can fetch refs with the url it was given
    const ref = await fetch(first.job.ref_urls[0]!);
    expect(ref.status).toBe(200);

    ext.send(JSON.stringify({ kind: 'job_status', job_id: first.job.id, status: 'running', step: 'generate' }));
    const clip = makeClip(join(t.root, 'take.mp4'), [['a', 3], ['b', 4]]);
    const up = await fetch(first.job.result_url, { method: 'POST', headers: { 'content-type': 'video/mp4' }, body: readFileSync(clip) });
    expect(up.status, await up.clone().text()).toBe(200);
    const body = (await up.json()) as { stored: string; status: string };
    expect(body.status).toBe('done');
    expect(body.stored).toBe(`episodes/ep01/gen/${t.ctx.jobs.get(first.job.id)!.batch_id}/v1.mp4`);
    expect(existsSync(t.ctx.store.abs(SID, body.stored))).toBe(true);
    expect(existsSync(t.ctx.store.episodePath(SID, 1, 'gen', 'ep01_s001', 'v1.json')) || existsSync(t.ctx.store.episodePath(SID, 1, 'gen', 'ep01_s003', 'v1.json'))).toBe(true);

    // next job is dispatched automatically after the upload
    const second = await nextJobMessage();
    expect(second.job.id).not.toBe(first.job.id);
    const up2 = await fetch(second.job.result_url, { method: 'POST', headers: { 'content-type': 'video/mp4' }, body: readFileSync(clip) });
    expect(up2.status).toBe(200);
    const third = await nextJobMessage();
    const up3 = await fetch(third.job.result_url, { method: 'POST', headers: { 'content-type': 'video/mp4' }, body: readFileSync(clip) });
    expect(up3.status).toBe(200);
    expect(t.ctx.jobs.list({ series_id: SID, episode: 1, kind: 'clip' }).every((j) => j.status === 'done')).toBe(true);
    expect(new SeriesService(t.ctx).loadEpisodeState(SID, 1).status).toBe('qc');
  }, 60_000);

  it('blocked (unknown page) halts the queue until resume; failed moves on', async () => {
    const episodes = new EpisodeService(t.ctx);
    await episodes.generate(SID, 1, { batch_ids: ['b01', 'b02'], quality: 'draft', fix_notes: 'retake' });
    const j1 = await nextJobMessage();
    expect(j1.job.prompt).toContain('[FIX] retake');
    ext.send(JSON.stringify({ kind: 'job_status', job_id: j1.job.id, status: 'blocked', selector: 'prompt_textarea', url: 'https://accounts.google.com/signin' }));
    await waitFor(() => t.ctx.jobs.get(j1.job.id)?.status === 'blocked');
    expect(t.ctx.jobs.get(j1.job.id)?.error).toContain('prompt_textarea');
    await new Promise((r) => setTimeout(r, 300));
    expect(inbox.filter((m) => m['kind'] === 'job').length).toBe(0); // halted: nothing dispatched
    expect(t.ctx.ext?.status().halted).toContain('ไม่รู้จัก');

    const resume = await app.inject({ method: 'POST', url: '/api/ext/resume', headers: { authorization: `Bearer ${token}` } });
    expect(resume.statusCode).toBe(200);
    const j2 = await nextJobMessage(); // the remaining queued b02 job
    ext.send(JSON.stringify({ kind: 'job_status', job_id: j2.job.id, status: 'failed', message: 'Flow error: quota' }));
    await waitFor(() => t.ctx.jobs.get(j2.job.id)?.status === 'failed');
    expect(t.ctx.jobs.get(j2.job.id)?.error).toContain('quota');
    expect(t.ctx.ext?.status().active_job).toBeNull();
  }, 30_000);

  it('sync_flow_characters creates character jobs and stores flow_character_id from the extension', async () => {
    const server = buildServer(t.ctx);
    const [c, s] = InMemoryTransport.createLinkedPair();
    await server.connect(s);
    const client = new Client({ name: 't', version: '0' });
    await client.connect(c);
    const res = await client.callTool({ name: 'sync_flow_characters', arguments: { series_id: SID } });
    const data = res.structuredContent as { job_ids: string[]; skipped: string[] };
    expect(data.job_ids.length).toBe(2);
    const j = await nextJobMessage();
    expect(j.job.kind).toBe('character');
    expect(j.job.ref_urls.length).toBe(1);
    ext.send(JSON.stringify({ kind: 'character_created', job_id: j.job.id, entity_id: t.ctx.jobs.get(j.job.id)!.entity_id, flow_character_id: 'flow_abc' }));
    await waitFor(() => t.ctx.jobs.get(j.job.id)?.status === 'done');
    const entity = t.ctx.jobs.get(j.job.id)!.entity_id!;
    expect(new SeriesService(t.ctx).loadEntity(SID, 'character', entity).flow_character_id).toBe('flow_abc');
    const j2 = await nextJobMessage();
    ext.send(JSON.stringify({ kind: 'character_created', job_id: j2.job.id, entity_id: t.ctx.jobs.get(j2.job.id)!.entity_id, flow_character_id: 'flow_def' }));
    await waitFor(() => t.ctx.jobs.get(j2.job.id)?.status === 'done');
    const again = await client.callTool({ name: 'sync_flow_characters', arguments: { series_id: SID } });
    expect((again.structuredContent as { job_ids: string[] }).job_ids).toEqual([]);
    const st = await client.callTool({ name: 'extension_status', arguments: {} });
    expect((st.structuredContent as { connected: boolean }).connected).toBe(true);
    await client.close();
    await server.close();
  }, 30_000);

  it('times out a job the extension never finishes and requeues when the extension disconnects', async () => {
    const episodes = new EpisodeService(t.ctx);
    await episodes.generate(SID, 1, { batch_ids: ['b03'], quality: 'draft' });
    const j = await nextJobMessage();
    expect(t.ctx.jobs.get(j.job.id)?.status).toBe('running');
    // disconnect mid-job -> requeued
    ext.terminate();
    await waitFor(() => t.ctx.jobs.get(j.job.id)?.status === 'queued', 5000);
    // reconnect -> dispatched again; then let the (10s) timeout fire
    ext = new WebSocket(`${base.replace('http', 'ws')}/ws?token=${token}&role=extension`);
    ext.on('message', (d) => inbox.push(JSON.parse(String(d))));
    await new Promise<void>((res) => ext.once('open', () => res()));
    const again = await nextJobMessage();
    expect(again.job.id).toBe(j.job.id);
    await waitFor(() => t.ctx.jobs.get(j.job.id)?.status === 'failed', 15_000);
    expect(t.ctx.jobs.get(j.job.id)?.error).toContain('ไม่ตอบกลับ');
  }, 40_000);
});
