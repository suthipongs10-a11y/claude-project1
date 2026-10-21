import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { z } from 'zod';
import { Aspect, EpisodeNumber, GateId, EntityType, Product, QcResult, Slug, Cost, summarizePreset } from '@series-studio/core';
import type { StudioContext, StudioEvent } from '../context.js';
import { codeRoot } from '../config.js';
import { SeriesService } from '../services/series.js';
import { BibleService } from '../services/bible.js';
import { GateService } from '../services/gates.js';
import { EpisodeService } from '../services/episode.js';
import { QcService } from '../services/qc.js';
import { AssemblyService } from '../services/assembly.js';
import { SettingsService } from '../services/settings.js';
import { summarizeSeries } from '../tools/_summary.js';
import { loadOrCreateToken, tokenMatches } from './token.js';
import { ExtensionBridge } from '../ext/bridge.js';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

export interface HttpServerOptions {
  token?: string;
  /** Folder with the built dashboard (index.html). Defaults to apps/dashboard/dist. */
  dashboardDir?: string;
}

const Comment = z.object({ t_sec: z.number().min(0), text: z.string().min(1), shot_id: Slug.optional() });

/**
 * Local HTTP + WS API for the dashboard PWA and the Chrome extension (SPEC §5, §11).
 * Binds only to 127.0.0.1 (config enforces it); every request needs the pairing token
 * (Authorization: Bearer <token>, X-Studio-Token header, or ?token= for media/WS).
 */
export function createHttpServer(ctx: StudioContext, opts: HttpServerOptions = {}): { app: FastifyInstance; token: string } {
  const token = opts.token ?? loadOrCreateToken(ctx.config.data_dir);
  const app = Fastify({ logger: false, bodyLimit: 20 * 1024 * 1024 });
  const series = new SeriesService(ctx);
  const bible = new BibleService(ctx, ctx.jobs);
  const gates = new GateService(ctx);
  const episodes = new EpisodeService(ctx);
  const qc = new QcService(ctx);
  const assembly = new AssemblyService(ctx);
  const settings = new SettingsService(ctx);
  const dashboardDir = opts.dashboardDir ?? join(codeRoot(), 'apps', 'dashboard', 'dist');
  let publicBase = `http://${ctx.config.http.host}:${ctx.config.http.port}`;
  const bridge = new ExtensionBridge(ctx, () => publicBase, () => token);
  ctx.ext = bridge;
  app.addHook('onListen', async () => {
    const addr = app.server.address();
    if (addr && typeof addr === 'object') publicBase = `http://${ctx.config.http.host}:${addr.port}`;
  });
  // raw bodies for result uploads (video/image bytes)
  app.addContentTypeParser(['video/mp4', 'video/webm', 'video/quicktime', 'image/png', 'image/jpeg', 'image/webp', 'application/octet-stream'], { parseAs: 'buffer', bodyLimit: 2 * 1024 * 1024 * 1024 }, (_req, body, done) => done(null, body));

  const givenToken = (req: FastifyRequest): string | undefined => {
    const h = req.headers['authorization'];
    if (typeof h === 'string' && h.startsWith('Bearer ')) return h.slice(7).trim();
    const x = req.headers['x-studio-token'];
    if (typeof x === 'string') return x;
    const q = (req.query as Record<string, unknown>)['token'];
    return typeof q === 'string' ? q : undefined;
  };

  app.addHook('onRequest', async (req, reply) => {
    const url = req.url.split('?')[0] ?? '';
    if (url.startsWith('/api/') || url.startsWith('/files/') || url === '/ws') {
      if (url === '/api/health') return;
      if (!tokenMatches(token, givenToken(req))) {
        reply.code(401).send({ error: 'ต้องใส่ token (เปิดจากลิงก์ที่มี ?token= ที่ได้จาก dashboard_info)' });
      }
    }
  });

  app.setErrorHandler((err: unknown, _req, reply) => {
    const e = err instanceof Error ? err : new Error(String(err));
    const status = (e as { statusCode?: number }).statusCode ?? 400;
    ctx.log.warn('http_error', { url: _req.url, error: e.message });
    reply.code(status >= 400 && status < 600 ? status : 400).send({ error: e.message });
  });

  // ------------------------------------------------------------ websocket change feed
  void app.register(websocket);
  void app.register(async (inst) => {
    inst.get('/ws', { websocket: true }, (socket, req) => {
      const role = String((req.query as Record<string, unknown>)['role'] ?? 'dashboard');
      const onChange = (ev: StudioEvent) => {
        try {
          socket.send(JSON.stringify({ kind: 'change', ...ev }));
        } catch {
          /* closed */
        }
      };
      ctx.events.on('change', onChange);
      ctx.log.info('ws_connected', { role });
      socket.send(JSON.stringify({ kind: 'hello', role, server: 'series-studio', at: ctx.now() }));
      const extSocket = { send: (text: string) => socket.send(text), close: () => socket.close() };
      if (role === 'extension') bridge.attach(extSocket);
      socket.on('message', (raw: Buffer) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(raw)) as Record<string, unknown>;
        } catch {
          return;
        }
        if (msg['kind'] === 'ping') socket.send(JSON.stringify({ kind: 'pong', at: ctx.now() }));
        if (role === 'extension') bridge.handleMessage(msg);
        else if (msg['kind'] !== 'ping') ctx.events.emit('ws_message', { role, ...msg });
      });
      socket.on('close', () => {
        ctx.events.off('change', onChange);
        if (role === 'extension') bridge.detach(extSocket);
        ctx.log.info('ws_closed', { role });
      });
    });
  });

  // ------------------------------------------------------------ api
  app.get('/api/health', async () => ({ ok: true, server: 'series-studio', at: ctx.now(), presets: ctx.presets.size }));
  app.get('/api/styles', async () => ({ styles: [...ctx.presets.values()].map(summarizePreset) }));
  app.get('/api/styles/:id', async (req) => {
    const p = ctx.presets.get((req.params as { id: string }).id);
    if (!p) throw Object.assign(new Error('ไม่พบสไตล์'), { statusCode: 404 });
    return { preset: p };
  });

  app.get('/api/series', async () => ({ series: series.list().map((s) => ({ ...s, cost: ctx.store.readJsonIfExists(join(ctx.store.seriesDir(s.id), 'cost.json'), Cost, 'cost') ?? null })) }));
  app.post('/api/series', async (req) => {
    const body = z
      .object({ id: Slug.optional(), title: z.string().min(1), logline: z.string().min(1), style_id: Slug, aspect: Aspect, episodes: EpisodeNumber, ep_length_sec: z.number().positive(), product: Product.optional(), engine_id: z.string().optional() })
      .parse(req.body);
    const s = series.create({ ...body, product: body.product ?? null });
    return { series: s };
  });
  app.get('/api/series/:id', async (req) => summarizeSeries(ctx, (req.params as { id: string }).id).data);
  app.get('/api/series/:id/bible', async (req) => {
    const id = (req.params as { id: string }).id;
    series.load(id);
    return { bible: series.loadBible(id) ?? null };
  });
  app.post('/api/series/:id/assets/:type/:eid/:action', async (req) => {
    const { id, type, eid, action } = req.params as { id: string; type: string; eid: string; action: string };
    const t = EntityType.parse(type);
    if (action === 'lock') return { entity: bible.lock(id, t, eid) };
    if (action === 'unlock') return { entity: bible.unlock(id, t, eid) };
    throw new Error(`action ต้องเป็น lock หรือ unlock`);
  });

  app.get('/api/series/:id/gates/:gate/check', async (req) => {
    const { id, gate } = req.params as { id: string; gate: string };
    const ep = (req.query as { episode?: string }).episode;
    return { check: gates.check(series.load(id), GateId.parse(gate), ep ? Number(ep) : undefined) };
  });
  app.post('/api/series/:id/gates/:gate', async (req, reply) => {
    const { id, gate } = req.params as { id: string; gate: string };
    const body = z.object({ episode: EpisodeNumber.optional(), note: z.string().optional() }).parse(req.body ?? {});
    const res = gates.approve(id, GateId.parse(gate), { episode: body.episode, note: body.note, via: 'dashboard' });
    if (!res.check.ok) return reply.code(409).send({ error: `${gate} ยังอนุมัติไม่ได้`, blockers: res.check.blockers });
    return { ok: true, series_status: res.series.status, warnings: res.check.warnings };
  });

  app.get('/api/series/:id/episodes/:n', async (req) => {
    const { id, n } = req.params as { id: string; n: string };
    const ep = Number(n);
    const s = series.load(id);
    series.requireEpisode(s, ep);
    const shotsFile = ctx.store.episodePath(id, ep, 'shots.json');
    const shots = ctx.store.exists(shotsFile) ? episodes.loadShots(id, ep) : null;
    const qcResults: Record<string, unknown> = {};
    const gen: Record<string, unknown> = {};
    for (const shot of shots?.shots ?? []) {
      const r = qc.loadResult(id, ep, shot.id);
      if (r) qcResults[shot.id] = r;
      const ptr = qc.latestPointer(id, ep, shot.id);
      if (ptr) {
        const version = Number(/v(\d+)\.[a-z0-9]+$/.exec(ptr.clip)?.[1] ?? 1);
        const frames = [1, 2, 3].map((i) => `episodes/ep${String(ep).padStart(2, '0')}/qc/frames/${shot.id}_v${version}_${i}.jpg`).filter((f) => ctx.store.exists(ctx.store.abs(id, f)));
        gen[shot.id] = { ...ptr, version, frames };
      }
    }
    const edit = ctx.store.episodePath(id, ep, 'edit');
    const previews = ctx.store.listFiles(edit, '.mp4').filter((f) => f.startsWith('preview_')).map((f) => `episodes/ep${String(ep).padStart(2, '0')}/edit/${f}`);
    const finals = ctx.store.listFiles(ctx.store.episodePath(id, ep, 'final'), '.mp4').map((f) => `episodes/ep${String(ep).padStart(2, '0')}/final/${f}`);
    const commentsFile = join(edit, 'comments.json');
    return {
      episode: ep,
      state: series.loadEpisodeState(id, ep),
      outline: series.loadOutline(id, ep) ?? null,
      script: episodes.loadScript(id, ep) ?? null,
      shots,
      batches: episodes.loadBatches(id, ep),
      qc: qcResults,
      gen,
      jobs: ctx.jobs.list({ series_id: id, episode: ep }),
      previews,
      finals,
      comments: existsSync(commentsFile) ? (JSON.parse(readFileSync(commentsFile, 'utf8')) as unknown[]) : [],
      timeline: ctx.store.readJsonIfExists(join(edit, 'timeline_final.json'), z.any(), 'timeline') ?? ctx.store.readJsonIfExists(join(edit, 'timeline_draft.json'), z.any(), 'timeline') ?? null,
    };
  });

  app.post('/api/series/:id/episodes/:n/shots/:shot/review', async (req) => {
    const { id, n, shot } = req.params as { id: string; n: string; shot: string };
    const body = z.object({ pass: z.boolean(), reason: z.string().min(1) }).parse(req.body);
    return { result: qc.review(id, Number(n), shot, { ...body, by: 'human' }) };
  });
  app.post('/api/series/:id/episodes/:n/shots/:shot/regen', async (req) => {
    const { id, n, shot } = req.params as { id: string; n: string; shot: string };
    const body = z.object({ fix_notes: z.string().min(1) }).parse(req.body);
    const res = await qc.regenShot(id, Number(n), shot, body.fix_notes);
    return { job_id: res.job.id, batch_id: res.batch_id, attempt: res.job.attempt, status: res.job.status };
  });
  app.post('/api/series/:id/episodes/:n/qc', async (req) => {
    const { id, n } = req.params as { id: string; n: string };
    const body = z.object({ shot_ids: z.array(Slug).optional(), auto_regen: z.boolean().optional(), wait_sec: z.int().min(0).max(120).default(30) }).parse(req.body ?? {});
    const task = ctx.tasks.start({ kind: 'run_qc', label: `QC ตอนที่ ${n}`, series_id: id, episode: Number(n) }, () => qc.runQc(id, Number(n), body));
    return (await ctx.tasks.waitFor(task.id, body.wait_sec * 1000)) ?? task;
  });
  app.post('/api/series/:id/episodes/:n/assemble', async (req) => {
    const { id, n } = req.params as { id: string; n: string };
    const body = z.object({ quality: z.enum(['draft', 'final']).default('draft'), aspect: Aspect.optional(), wait_sec: z.int().min(0).max(120).default(20) }).parse(req.body ?? {});
    const task = ctx.tasks.start({ kind: 'assemble', label: `ประกอบตอนที่ ${n} (${body.quality})`, series_id: id, episode: Number(n) }, async () => {
      const res = await assembly.assemble(id, Number(n), body);
      return { timeline: res.timeline, warnings: res.warnings };
    });
    return (await ctx.tasks.waitFor(task.id, body.wait_sec * 1000)) ?? task;
  });
  app.get('/api/tasks', async (req) => {
    const q = req.query as { series_id?: string; episode?: string; status?: string };
    return { tasks: ctx.tasks.list({ series_id: q.series_id, episode: q.episode ? Number(q.episode) : undefined, status: q.status as 'running' | 'done' | 'failed' | undefined }) };
  });
  app.get('/api/tasks/:id', async (req, reply) => {
    const t = ctx.tasks.get((req.params as { id: string }).id);
    if (!t) return reply.code(404).send({ error: 'ไม่พบ task' });
    return t;
  });
  app.post('/api/series/:id/episodes/:n/comments', async (req) => {
    const { id, n } = req.params as { id: string; n: string };
    const ep = Number(n);
    series.requireEpisode(series.load(id), ep);
    const c = Comment.parse(req.body);
    const file = join(ctx.store.episodePath(id, ep, 'edit'), 'comments.json');
    const list = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as unknown[]) : [];
    const entry = { ...c, at: ctx.now(), shot_id: c.shot_id ?? shotAtTime(id, ep, c.t_sec) };
    list.push(entry);
    ctx.store.writeJson(file, list);
    ctx.emit({ type: 'comments', series_id: id, episode: ep });
    return { comment: entry, count: list.length };
  });
  app.post('/api/series/:id/episodes/:n/export', async (req) => {
    const { id, n } = req.params as { id: string; n: string };
    const ep = Number(n);
    const s = series.load(id);
    series.requireEpisode(s, ep);
    const body = z.object({ folder: z.string().min(1).optional() }).parse(req.body ?? {});
    const st = series.loadEpisodeState(id, ep);
    if (!st.gates.G4.approved) throw Object.assign(new Error('ต้องอนุมัติ G4 ก่อน export'), { statusCode: 409 });
    const finalDir = ctx.store.episodePath(id, ep, 'final');
    const files = [...ctx.store.listFiles(finalDir, '.mp4'), ...ctx.store.listFiles(finalDir, '.srt'), ...ctx.store.listFiles(finalDir, '.jpg')];
    if (!files.length) throw new Error('ไม่มีไฟล์ใน final/');
    const dest = resolve(body.folder ?? ctx.config.export_dir, id);
    mkdirSync(dest, { recursive: true });
    for (const f of files) copyFileSync(join(finalDir, f), join(dest, f));
    if (st.status === 'final_ready') series.saveEpisodeState(id, { ...st, status: 'exported' });
    return { exported: files.map((f) => join(dest, f)) };
  });

  app.get('/api/jobs', async (req) => {
    const q = req.query as { series_id?: string; episode?: string };
    if (!q.series_id) return { jobs: series.list().flatMap((s) => ctx.jobs.list({ series_id: s.id })) };
    return { jobs: ctx.jobs.list(q.episode ? { series_id: q.series_id, episode: Number(q.episode) } : { series_id: q.series_id }) };
  });
  app.get('/api/settings', async () => ({ ...settings.current(), token_hint: token.slice(0, 4) + '…' }));
  app.put('/api/settings', async (req) => settings.update((req.body ?? {}) as Record<string, unknown>));

  // ------------------------------------------------------------ chrome extension (flow_ext)
  app.get('/api/ext/status', async () => ({ ...bridge.status(), engine: ctx.config.engines['flow_ext'] ?? null }));
  app.get('/api/ext/selectors', async () => bridge.loadSelectors());
  app.post('/api/ext/resume', async () => {
    bridge.resume();
    return { ok: true, ...bridge.status() };
  });
  app.post('/api/ext/jobs/:id/cancel', async (req) => {
    bridge.cancel((req.params as { id: string }).id);
    return { ok: true };
  });
  app.post('/api/ext/jobs/:id/result', async (req) => {
    const id = (req.params as { id: string }).id;
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) throw new Error('ต้องส่งไฟล์เป็น body (video/mp4 หรือ image/png)');
    const ct = String(req.headers['content-type'] ?? 'application/octet-stream');
    const ext = ct.includes('webm') ? '.webm' : ct.includes('quicktime') ? '.mov' : ct.includes('png') ? '.png' : ct.includes('jpeg') ? '.jpg' : ct.includes('webp') ? '.webp' : '.mp4';
    const dir = mkdtempSync(join(tmpdir(), 'series-studio-upload-'));
    const tmp = join(dir, `${id}${ext}`);
    writeFileSync(tmp, body);
    try {
      const res = bridge.attachResult(id, tmp);
      return { ok: true, stored: res.stored, status: res.job.status };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // ------------------------------------------------------------ media files inside projects/<series>/
  app.get('/files/:id/*', async (req, reply) => {
    const { id } = req.params as { id: string; '*': string };
    const rel = (req.params as { '*': string })['*'];
    const abs = ctx.store.abs(id, rel);
    if (!existsSync(abs) || !statSync(abs).isFile()) return reply.code(404).send({ error: 'ไม่พบไฟล์' });
    return reply.sendFile(basename(abs), resolve(abs, '..'));
  });

  // ------------------------------------------------------------ dashboard (built PWA) + fallback
  void app.register(fastifyStatic, { root: existsSync(dashboardDir) ? dashboardDir : codeRoot(), serve: false });
  app.get('/', async (_req, reply) => {
    const index = join(dashboardDir, 'index.html');
    if (!existsSync(index)) return reply.type('text/html; charset=utf-8').send('<!doctype html><meta charset="utf-8"><h1>Series Studio</h1><p>ยังไม่ได้ build dashboard — รัน <code>pnpm --filter @series-studio/dashboard build</code></p>');
    return reply.type('text/html; charset=utf-8').send(readFileSync(index, 'utf8'));
  });
  app.get('/assets/*', async (req, reply) => {
    const rel = (req.params as { '*': string })['*'];
    const abs = join(dashboardDir, 'assets', rel);
    if (!existsSync(abs)) return reply.code(404).send('not found');
    return reply.sendFile(basename(abs), resolve(abs, '..'));
  });
  for (const f of ['manifest.webmanifest', 'sw.js', 'icon.svg']) {
    app.get(`/${f}`, async (_req, reply) => {
      const abs = join(dashboardDir, f);
      if (!existsSync(abs)) return reply.code(404).send('not found');
      return reply.sendFile(f, dashboardDir);
    });
  }

  function shotAtTime(seriesId: string, ep: number, t: number): string | undefined {
    const edit = ctx.store.episodePath(seriesId, ep, 'edit');
    const tl = ctx.store.readJsonIfExists(join(edit, 'timeline_final.json'), z.any(), 'tl') ?? ctx.store.readJsonIfExists(join(edit, 'timeline_draft.json'), z.any(), 'tl');
    if (!tl) return undefined;
    const shots = ctx.store.exists(ctx.store.episodePath(seriesId, ep, 'shots.json')) ? episodes.loadShots(seriesId, ep) : null;
    for (const seg of (tl as { segments: Array<{ kind: string; start_sec: number; out_sec: number; in_sec: number; shot_ids: string[] }> }).segments) {
      if (seg.kind !== 'clip') continue;
      if (t < seg.start_sec || t >= seg.start_sec + (seg.out_sec - seg.in_sec)) continue;
      let off = seg.start_sec;
      for (const sid of seg.shot_ids) {
        const d = shots?.shots.find((s) => s.id === sid)?.duration_sec ?? 0;
        if (t < off + d) return sid;
        off += d;
      }
      return seg.shot_ids.at(-1);
    }
    return undefined;
  }

  return { app, token };
}

export async function startHttpServer(ctx: StudioContext, opts: HttpServerOptions = {}): Promise<{ app: FastifyInstance; token: string; url: string }> {
  const { app, token } = createHttpServer(ctx, opts);
  const { host, port } = ctx.config.http;
  await app.listen({ host, port });
  const url = `http://${host}:${port}/?token=${token}`;
  ctx.log.info('http_started', { host, port });
  return { app, token, url };
}

export { QcResult };
