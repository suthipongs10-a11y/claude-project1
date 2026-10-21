import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { ExtClientMessage, ExtJobPayload, FlowSelectors, type ExtServerMessage, type GenJob, type FlowSelectors as FlowSelectorsT } from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { engineConfig } from '../config.js';
import { SeriesService } from '../services/series.js';
import { EpisodeService } from '../services/episode.js';
import { BibleService } from '../services/bible.js';

export interface ExtSocket {
  send(text: string): void;
  close(): void;
}

interface Connection {
  socket: ExtSocket;
  version: string;
  connectedAt: string;
}

/**
 * Server side of the flow_ext engine (SPEC §10): exactly one connected Chrome extension works on
 * exactly one job at a time. Jobs with engine_id = flow_ext and status = queued are dispatched in
 * creation order; the extension reports progress over WS and uploads results over HTTP.
 * Unknown-page/blocked reports stop the queue until a human looks at it.
 */
export class ExtensionBridge {
  private connection: Connection | null = null;
  private activeJobId: string | null = null;
  private activeSince = 0;
  private timer: NodeJS.Timeout | null = null;
  private halted: string | null = null;

  constructor(
    private readonly ctx: StudioContext,
    private readonly baseUrl: () => string,
    private readonly token: () => string,
  ) {}

  // ------------------------------------------------------------ connection
  attach(socket: ExtSocket): void {
    if (this.connection) {
      try {
        this.connection.socket.close();
      } catch {
        /* ignore */
      }
    }
    this.connection = { socket, version: 'unknown', connectedAt: this.ctx.now() };
    this.ctx.log.info('ext_connected');
    this.ctx.emit({ type: 'extension', connected: true });
    this.pump();
  }

  detach(socket: ExtSocket): void {
    if (this.connection?.socket !== socket) return;
    this.connection = null;
    this.ctx.log.warn('ext_disconnected', { active_job: this.activeJobId });
    if (this.activeJobId) {
      // the extension went away mid-job: requeue so the next connection picks it up
      const job = this.ctx.jobs.get(this.activeJobId);
      if (job && job.status === 'running') this.ctx.jobs.update(job.id, { status: 'queued', updated_at: this.ctx.now() });
      this.clearActive();
    }
    this.ctx.emit({ type: 'extension', connected: false });
  }

  status(): { connected: boolean; version?: string; connected_at?: string; active_job: string | null; halted: string | null; queued: number } {
    const queued = this.queuedJobs().length;
    return {
      connected: this.connection !== null,
      ...(this.connection ? { version: this.connection.version, connected_at: this.connection.connectedAt } : {}),
      active_job: this.activeJobId,
      halted: this.halted,
      queued,
    };
  }

  /** Clear a blocked/halted state after a human fixed the page or the selectors. */
  resume(): void {
    this.halted = null;
    this.ctx.log.info('ext_resumed');
    this.pump();
  }

  // ------------------------------------------------------------ messages from the extension
  handleMessage(raw: unknown): void {
    const parsed = ExtClientMessage.safeParse(raw);
    if (!parsed.success) {
      this.ctx.log.warn('ext_bad_message', { raw: JSON.stringify(raw).slice(0, 300) });
      return;
    }
    const msg = parsed.data;
    switch (msg.kind) {
      case 'ping':
        return;
      case 'ext_hello':
        if (this.connection) this.connection.version = msg.version;
        this.ctx.log.info('ext_hello', { version: msg.version, busy: msg.busy });
        if (!msg.busy) this.pump();
        return;
      case 'job_status': {
        const job = this.ctx.jobs.get(msg.job_id);
        if (!job) return;
        const now = this.ctx.now();
        if (msg.status === 'running') {
          this.ctx.jobs.update(job.id, { status: 'running', updated_at: now, ...(msg.step ? { error: undefined } : {}) });
          this.ctx.emit({ type: 'jobs', series_id: job.series_id, ...(job.episode !== undefined ? { episode: job.episode } : {}), job_id: job.id, step: msg.step });
        } else if (msg.status === 'blocked') {
          const reason = `หยุดเพราะเจอหน้าที่ไม่รู้จัก${msg.selector ? ` (ไม่พบ selector "${msg.selector}")` : ''}${msg.url ? ` ที่ ${msg.url}` : ''}${msg.message ? `: ${msg.message}` : ''}`;
          this.ctx.jobs.update(job.id, { status: 'blocked', error: reason, updated_at: now });
          this.halted = reason;
          this.clearActive();
          this.ctx.log.warn('ext_blocked', { job_id: job.id, selector: msg.selector, url: msg.url });
          this.ctx.emit({ type: 'extension_blocked', series_id: job.series_id, job_id: job.id, reason });
        } else if (msg.status === 'failed') {
          this.ctx.jobs.update(job.id, { status: 'failed', error: msg.message ?? 'extension รายงานว่าล้มเหลว', updated_at: now });
          this.clearActive();
          this.ctx.emit({ type: 'jobs', series_id: job.series_id, ...(job.episode !== undefined ? { episode: job.episode } : {}), job_id: job.id });
          this.pump();
        } else if (msg.status === 'done') {
          // 'done' without an upload is only valid for character jobs; clip/ref jobs finish on upload
          if (job.kind === 'character' && job.status !== 'done') this.ctx.jobs.update(job.id, { status: 'done', updated_at: now });
          if (this.activeJobId === job.id) this.clearActive();
          this.pump();
        }
        return;
      }
      case 'character_created': {
        const job = this.ctx.jobs.get(msg.job_id);
        if (!job || job.kind !== 'character') return;
        const series = new SeriesService(this.ctx);
        const c = series.loadEntity(job.series_id, 'character', msg.entity_id);
        series.saveEntity(job.series_id, 'character', { ...c, flow_character_id: msg.flow_character_id });
        this.ctx.jobs.update(job.id, { status: 'done', output: undefined, updated_at: this.ctx.now() });
        this.ctx.log.info('flow_character_saved', { series_id: job.series_id, entity_id: msg.entity_id, flow_character_id: msg.flow_character_id });
        this.ctx.emit({ type: 'bible', series_id: job.series_id, entity_id: msg.entity_id });
        if (this.activeJobId === job.id) this.clearActive();
        this.pump();
        return;
      }
    }
  }

  /** Result upload (clip or image bytes) for the active job. Returns the stored relative path. */
  attachResult(jobId: string, tmpFile: string): { stored: string; job: GenJob } {
    const job = this.ctx.jobs.get(jobId);
    if (!job) throw new Error(`ไม่พบงาน ${jobId}`);
    if (job.status === 'done') throw new Error(`งาน ${jobId} เสร็จแล้ว`);
    let stored: string;
    if (job.kind === 'clip') {
      if (job.episode === undefined) throw new Error('clip job ไม่มี episode');
      const episodes = new EpisodeService(this.ctx);
      stored = episodes.attachClip(job.series_id, job.episode, job, tmpFile);
      episodes.maybeEnterQc(job.series_id, job.episode);
    } else if (job.kind === 'ref') {
      if (!job.entity_type || !job.entity_id) throw new Error('ref job ไม่มี entity');
      const res = new BibleService(this.ctx, this.ctx.jobs).importRefs(job.series_id, job.entity_type, job.entity_id, [tmpFile], { job_id: job.id });
      stored = res.added[0] ?? '';
    } else {
      throw new Error('character job ไม่มีไฟล์ผลลัพธ์ (ใช้ข้อความ character_created)');
    }
    const updated = this.ctx.jobs.get(jobId)!;
    this.ctx.log.info('ext_result_attached', { job_id: jobId, kind: job.kind, stored });
    // The extension reports `done` once it has reset its busy flag; only then is the next job sent.
    // Fallback: if that message never comes (old extension, crash), move on after a short settle.
    if (this.activeJobId === jobId) {
      setTimeout(() => {
        if (this.activeJobId === jobId) {
          this.clearActive();
          this.pump();
        }
      }, 5000).unref?.();
    }
    return { stored, job: updated };
  }

  // ------------------------------------------------------------ dispatch
  queuedJobs(): GenJob[] {
    return this.ctx.jobs.list({ status: 'queued' }).filter((j) => j.engine_id === 'flow_ext');
  }

  /** Dispatch the next queued job if the extension is connected and idle. */
  pump(): void {
    if (!this.connection || this.activeJobId || this.halted) return;
    const next = this.queuedJobs()[0];
    if (!next) return;
    try {
      const payload = this.buildPayload(next);
      const msg: ExtServerMessage = { kind: 'job', job: payload };
      this.connection.socket.send(JSON.stringify(msg));
      this.activeJobId = next.id;
      this.activeSince = Date.now();
      this.ctx.jobs.update(next.id, { status: 'running', updated_at: this.ctx.now() });
      this.armTimeout(payload.timeout_sec);
      this.ctx.log.info('ext_dispatch', { job_id: next.id, kind: next.kind });
      this.ctx.emit({ type: 'jobs', series_id: next.series_id, ...(next.episode !== undefined ? { episode: next.episode } : {}), job_id: next.id });
    } catch (e) {
      this.ctx.jobs.update(next.id, { status: 'failed', error: (e as Error).message, updated_at: this.ctx.now() });
      this.ctx.log.error('ext_dispatch_failed', { job_id: next.id, error: (e as Error).message });
      this.pump();
    }
  }

  cancel(jobId: string): void {
    const job = this.ctx.jobs.get(jobId);
    if (!job) throw new Error(`ไม่พบงาน ${jobId}`);
    if (this.activeJobId === jobId && this.connection) {
      const msg: ExtServerMessage = { kind: 'cancel', job_id: jobId };
      this.connection.socket.send(JSON.stringify(msg));
      this.clearActive();
    }
    this.ctx.jobs.update(jobId, { status: 'cancelled', updated_at: this.ctx.now() });
    this.pump();
  }

  buildPayload(job: GenJob): ExtJobPayload {
    const cfg = engineConfig(this.ctx.config, 'flow_ext');
    const series = new SeriesService(this.ctx).load(job.series_id);
    const base = this.baseUrl();
    const tok = encodeURIComponent(this.token());
    const refUrl = (rel: string) => `${base}/files/${encodeURIComponent(job.series_id)}/${rel.split('/').map(encodeURIComponent).join('/')}?token=${tok}`;
    const flowIds: string[] = [];
    if (job.kind === 'clip') {
      for (const c of new SeriesService(this.ctx).listEntities(job.series_id, 'character')) if (c.flow_character_id) flowIds.push(c.flow_character_id);
    }
    return ExtJobPayload.parse({
      id: job.id,
      kind: job.kind,
      series_id: job.series_id,
      ...(job.episode !== undefined ? { episode: job.episode } : {}),
      ...(job.batch_id ? { batch_id: job.batch_id } : {}),
      ...(job.entity_type ? { entity_type: job.entity_type } : {}),
      ...(job.entity_id ? { entity_id: job.entity_id } : {}),
      ...(job.view ? { view: job.view } : {}),
      prompt: job.fix_notes && !job.prompt.includes('[FIX]') ? `${job.prompt}\n[FIX] ${job.fix_notes}` : job.prompt,
      aspect: job.kind === 'clip' || job.entity_type === 'location' ? series.aspect : '9:16',
      quality: job.quality,
      ref_urls: job.ref_images.map(refUrl),
      flow_character_ids: flowIds,
      timeout_sec: cfg.jobTimeoutSec ?? 900,
      delays_ms: { min: cfg.minDelayMs ?? 5000, max: Math.max(cfg.maxDelayMs ?? 15000, cfg.minDelayMs ?? 5000) },
      selectors_url: `${base}/api/ext/selectors?token=${tok}`,
      result_url: `${base}/api/ext/jobs/${encodeURIComponent(job.id)}/result?token=${tok}`,
    });
  }

  loadSelectors(): FlowSelectorsT {
    const cfg = engineConfig(this.ctx.config, 'flow_ext');
    const rel = cfg.selectorsFile ?? 'config/flow-selectors.json';
    const file = isAbsolute(rel) ? rel : resolve(this.ctx.config.root, rel);
    if (!existsSync(file)) throw new Error(`ไม่พบไฟล์ selectors: ${file}`);
    return FlowSelectors.parse(JSON.parse(readFileSync(file, 'utf8')));
  }

  private armTimeout(sec: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const id = this.activeJobId;
      if (!id) return;
      const job = this.ctx.jobs.get(id);
      if (job && job.status === 'running') {
        this.ctx.jobs.update(id, { status: 'failed', error: `extension ไม่ตอบกลับภายใน ${sec} วินาที`, updated_at: this.ctx.now() });
        this.ctx.log.warn('ext_job_timeout', { job_id: id, since_ms: Date.now() - this.activeSince });
        this.ctx.emit({ type: 'jobs', series_id: job.series_id, ...(job.episode !== undefined ? { episode: job.episode } : {}), job_id: id });
      }
      this.clearActive();
      this.pump();
    }, sec * 1000);
    this.timer.unref?.();
  }

  private clearActive(): void {
    this.activeJobId = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  close(): void {
    this.clearActive();
    this.connection?.socket.close();
    this.connection = null;
  }
}
