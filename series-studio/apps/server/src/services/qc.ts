import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { QcResult, type QcResult as QcResultT, type Shot, transitionEpisode } from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { requirePreset } from '../context.js';
import { codeRoot } from '../config.js';
import { resolvePython } from '../util/python.js';
import { run, extractKeyframes } from '../util/ffmpeg.js';
import { EpisodeService } from './episode.js';
import { SeriesService } from './series.js';

interface GenPointer {
  shot_id: string;
  clip: string;
  offset_sec: number;
  duration_sec: number;
  job_id: string;
  batch_id: string;
}

export interface QcRunSummary {
  results: QcResultT[];
  summary: { shots: number; pass: number; fail: number };
  skipped_checks: string[];
  errors: string[];
  regen?: Array<{ shot_id: string; batch_id: string; job_id?: string; skipped_reason?: string }>;
}

/** Deterministic fix notes derived from failed checks (SPEC §8.7: regen = same prompt + adjustments). */
export function fixNotesFromReasons(result: QcResultT): string {
  const notes: string[] = [];
  for (const c of result.checks) {
    if (c.pass || c.skipped) continue;
    switch (c.name) {
      case 'identity':
        notes.push('keep every character exactly identical to the reference images (face shape, hair, mole/scar, wardrobe)');
        break;
      case 'people':
        notes.push('no extra people in frame; only the listed characters');
        break;
      case 'black':
        notes.push('no fade to black, no black frames');
        break;
      case 'freeze':
        notes.push('continuous natural motion, no frozen frames');
        break;
      case 'cuts':
        notes.push('cut exactly at the listed shot boundaries, no extra cuts inside a shot');
        break;
      case 'duration':
        notes.push('match the total duration exactly');
        break;
      case 'dialogue':
        notes.push('speak the dialogue clearly and completely as written');
        break;
      case 'text':
        notes.push('no on-screen text, captions or watermarks');
        break;
      default:
        notes.push(c.detail ?? c.name);
    }
  }
  return [...new Set(notes)].join('; ');
}

export class QcService {
  private readonly series: SeriesService;
  private readonly episodes: EpisodeService;

  constructor(private readonly ctx: StudioContext) {
    this.series = new SeriesService(ctx);
    this.episodes = new EpisodeService(ctx);
  }

  private get store() {
    return this.ctx.store;
  }

  /** Latest gen pointer per shot (highest version). */
  latestPointer(seriesId: string, n: number, shotId: string): GenPointer | undefined {
    const dir = this.store.episodePath(seriesId, n, 'gen', shotId);
    const versions = this.store
      .listFiles(dir, '.json')
      .map((f) => Number(/^v(\d+)\.json$/.exec(f)?.[1]))
      .filter((v) => Number.isFinite(v))
      .sort((a, b) => a - b);
    const v = versions.at(-1);
    if (v === undefined) return undefined;
    return JSON.parse(readFileSync(join(dir, `v${v}.json`), 'utf8')) as GenPointer;
  }

  qcFile(seriesId: string, n: number, shotId: string): string {
    return this.store.episodePath(seriesId, n, 'qc', `${shotId}.json`);
  }

  loadResult(seriesId: string, n: number, shotId: string): QcResultT | undefined {
    return this.store.readJsonIfExists(this.qcFile(seriesId, n, shotId), QcResult, `qc/${shotId}.json`);
  }

  /** Build the worker request for the given shots (default: every shot that has a clip). */
  buildRequest(seriesId: string, n: number, shotIds?: string[]): { request: Record<string, unknown>; missing: string[] } {
    const series = this.series.load(seriesId);
    const preset = requirePreset(this.ctx, series.style_id);
    const bible = this.episodes.requireBible(seriesId);
    const list = this.episodes.loadShots(seriesId, n);
    const wanted = shotIds?.length ? list.shots.filter((s) => shotIds.includes(s.id)) : list.shots;
    const unknown = (shotIds ?? []).filter((id) => !list.shots.some((s) => s.id === id));
    if (unknown.length) throw new Error(`ไม่พบช็อต: ${unknown.join(', ')}`);
    const clips = new Map<string, { batch_id: string; clip: string; version: number; expected_sec: number; shots: Array<Record<string, unknown>> }>();
    const missing: string[] = [];
    const refsOf = (id: string) => bible.characters.find((c) => c.id === id)?.refs ?? [];
    for (const s of wanted) {
      const ptr = this.latestPointer(seriesId, n, s.id);
      if (!ptr) {
        missing.push(s.id);
        continue;
      }
      const version = Number(/v(\d+)\.[a-z0-9]+$/.exec(ptr.clip)?.[1] ?? 1);
      const key = ptr.clip;
      const entry = clips.get(key) ?? { batch_id: ptr.batch_id, clip: ptr.clip, version, expected_sec: 0, shots: [] };
      entry.shots.push({
        shot_id: s.id,
        offset_sec: ptr.offset_sec,
        duration_sec: s.duration_sec,
        dialogue: s.dialogue,
        characters: s.characters.map((c) => ({ id: c.id, refs: refsOf(c.id) })),
        max_people: s.max_people ?? s.characters.length,
      });
      clips.set(key, entry);
    }
    // expected clip duration = sum of all shots in the batch (not only the requested ones)
    for (const entry of clips.values()) {
      const batchShots = list.shots.filter((s) => s.batch === entry.batch_id);
      entry.expected_sec = Math.round((batchShots.length ? batchShots : wanted).reduce((sum, s) => sum + s.duration_sec, 0) * 10) / 10;
      entry.shots.sort((a, b) => (a['offset_sec'] as number) - (b['offset_sec'] as number));
    }
    const qc = this.ctx.config.qc;
    const request = {
      version: 1,
      series_id: seriesId,
      episode: n,
      root: this.store.seriesDir(seriesId),
      tools: { ffmpeg: this.ctx.config.tools.ffmpeg, ffprobe: this.ctx.config.tools.ffprobe },
      thresholds: {
        duration_tolerance: qc.duration_tolerance,
        cut_tolerance: qc.cut_tolerance,
        cer_max: preset.qc?.cer_max ?? qc.cer_max,
        identity_similarity_min: preset.qc?.identity_similarity_min ?? qc.identity_similarity_min,
        black_min_sec: qc.black_min_sec,
        freeze_min_sec: qc.freeze_min_sec,
        scdet_threshold: qc.scdet_threshold,
        keyframes_per_shot: qc.keyframes_per_shot,
        ocr: qc.ocr,
      },
      medium: preset.medium,
      dialogue_mode: preset.dialogue_mode,
      lang: preset.dialogue_lang_in_model,
      whisper: { model: qc.whisper_model, device: qc.whisper_device, compute_type: qc.whisper_compute_type },
      frames_dir: `episodes/ep${String(n).padStart(2, '0')}/qc/frames`,
      clips: [...clips.values()].sort((a, b) => a.batch_id.localeCompare(b.batch_id)),
    };
    return { request, missing };
  }

  /** Run the Python worker and persist qc/<shot>.json for every result. */
  async runQc(seriesId: string, n: number, opts: { shot_ids?: string[] | undefined; auto_regen?: boolean | undefined } = {}): Promise<QcRunSummary> {
    const series = this.series.load(seriesId);
    this.series.requireEpisode(series, n);
    const { request, missing } = this.buildRequest(seriesId, n, opts.shot_ids);
    if ((request['clips'] as unknown[]).length === 0) throw new Error(`ตอนที่ ${n} ยังไม่มีคลิปให้ตรวจ (ใช้ import_clips ก่อน)${missing.length ? ` ช็อตที่ไม่มีคลิป: ${missing.join(', ')}` : ''}`);
    const reqFile = this.store.episodePath(seriesId, n, 'qc', '_request.json');
    this.store.writeJson(reqFile, request);
    const started = Date.now();
    const python = resolvePython(this.ctx.config.tools.python, this.ctx.config.root);
    const r = await run(python, ['-m', 'workers.qc.run', '--request', reqFile], {
      cwd: codeRoot(),
      env: { ...process.env, PYTHONPATH: codeRoot(), PYTHONIOENCODING: 'utf-8' },
      timeoutMs: this.ctx.config.qc.worker_timeout_sec * 1000,
    });
    this.ctx.log.info('qc_worker', { series_id: seriesId, episode: n, code: r.code, ms: Date.now() - started });
    if (!r.stdout.trim()) throw new Error(`QC worker ไม่ส่งผลลัพธ์ (exit ${r.code}): ${r.stderr.trim().slice(-800)}`);
    let report: { results: Array<Record<string, unknown>>; summary: QcRunSummary['summary']; skipped_checks: string[]; errors: string[] };
    try {
      report = JSON.parse(r.stdout.trim().split('\n').at(-1) as string);
    } catch {
      throw new Error(`อ่านผล QC worker ไม่ได้: ${r.stdout.slice(0, 400)} ${r.stderr.slice(-400)}`);
    }
    const now = this.ctx.now();
    const results: QcResultT[] = [];
    for (const raw of report.results) {
      const prev = this.loadResult(seriesId, n, String(raw['shot_id']));
      const { keyframes: _k, ...rest } = raw as Record<string, unknown> & { keyframes?: string[] };
      const parsed = QcResult.parse({ ...rest, at: now, ...(prev?.review && prev.version === rest['version'] ? { review: prev.review } : {}) });
      this.store.writeJson(this.qcFile(seriesId, n, parsed.shot_id), parsed);
      results.push(parsed);
    }
    const state = this.series.loadEpisodeState(seriesId, n);
    if (state.status === 'generating') this.series.saveEpisodeState(seriesId, { ...state, status: transitionEpisode(state.status, 'qc') });
    this.ctx.emit({ type: 'qc', series_id: seriesId, episode: n });
    const out: QcRunSummary = { results, summary: report.summary, skipped_checks: report.skipped_checks, errors: [...report.errors, ...missing.map((id) => `ช็อต ${id} ไม่มีคลิป`)] };
    if (opts.auto_regen) out.regen = await this.autoRegen(seriesId, n, results);
    return out;
  }

  /** Queue regen jobs for failed shots, bounded by qc.max_regen_attempts (then wait for a human). */
  async autoRegen(seriesId: string, n: number, results: QcResultT[]): Promise<NonNullable<QcRunSummary['regen']>> {
    const out: NonNullable<QcRunSummary['regen']> = [];
    const batches = new Map<string, { shots: string[]; notes: string[] }>();
    const list = this.episodes.loadShots(seriesId, n);
    for (const r of results) {
      if (r.pass || r.review?.pass) continue;
      const shot = list.shots.find((s) => s.id === r.shot_id);
      if (!shot?.batch) continue;
      const b = batches.get(shot.batch) ?? { shots: [], notes: [] };
      b.shots.push(r.shot_id);
      b.notes.push(fixNotesFromReasons(r));
      batches.set(shot.batch, b);
    }
    for (const [batchId, b] of batches) {
      try {
        const res = await this.regenBatch(seriesId, n, batchId, [...new Set(b.notes.flatMap((x) => x.split('; ')))].join('; '));
        for (const sid of b.shots) out.push({ shot_id: sid, batch_id: batchId, job_id: res.job.id });
      } catch (e) {
        for (const sid of b.shots) out.push({ shot_id: sid, batch_id: batchId, skipped_reason: (e as Error).message });
      }
    }
    return out;
  }

  /** Regenerate the batch containing a shot with fix notes appended to its (deterministic) prompt. */
  async regenShot(seriesId: string, n: number, shotId: string, fixNotes: string): Promise<{ job: Awaited<ReturnType<EpisodeService['generate']>>[number]; batch_id: string; shot_ids: string[] }> {
    const list = this.episodes.loadShots(seriesId, n);
    const shot: Shot | undefined = list.shots.find((s) => s.id === shotId);
    if (!shot) throw new Error(`ไม่พบช็อต ${shotId} ในตอนที่ ${n}`);
    if (!shot.batch) throw new Error(`ช็อต ${shotId} ยังไม่ถูกจัด batch (ใช้ compile_prompts ก่อน)`);
    return this.regenBatch(seriesId, n, shot.batch, fixNotes);
  }

  private async regenBatch(seriesId: string, n: number, batchId: string, fixNotes: string) {
    const attempts = this.ctx.jobs.list({ series_id: seriesId, episode: n, kind: 'clip', batch_id: batchId }).length;
    const max = this.ctx.config.qc.max_regen_attempts;
    if (attempts > max) {
      throw new Error(`batch ${batchId} เจนไปแล้ว ${attempts} ครั้ง (เกินโควตาเจนซ่อม ${max} ครั้ง) รอคนตัดสิน: แก้ shot/prompt เองแล้วสั่ง generate หรือรับช็อตนี้ด้วย review_shot`);
    }
    const batch = this.episodes.loadBatches(seriesId, n).find((b) => b.id === batchId);
    if (!batch) throw new Error(`ไม่พบ batch ${batchId}`);
    const jobs = await this.episodes.generate(seriesId, n, { batch_ids: [batchId], quality: 'draft', fix_notes: fixNotes });
    const job = jobs[0]!;
    this.ctx.log.info('regen', { series_id: seriesId, episode: n, batch_id: batchId, job_id: job.id, attempt: job.attempt, fix_notes: fixNotes });
    return { job, batch_id: batchId, shot_ids: batch.shot_ids };
  }

  /** Extract (or reuse) keyframes for a shot and return their absolute paths. */
  async keyframes(seriesId: string, n: number, shotId: string, count?: number): Promise<{ files: string[]; clip: string; version: number }> {
    const ptr = this.latestPointer(seriesId, n, shotId);
    if (!ptr) throw new Error(`ช็อต ${shotId} ยังไม่มีคลิป (import_clips ก่อน)`);
    const version = Number(/v(\d+)\.[a-z0-9]+$/.exec(ptr.clip)?.[1] ?? 1);
    const nFrames = count ?? this.ctx.config.qc.keyframes_per_shot;
    const dir = this.store.episodePath(seriesId, n, 'qc', 'frames');
    const stem = `${shotId}_v${version}`;
    const existing = Array.from({ length: nFrames }, (_, i) => join(dir, `${stem}_${i + 1}.jpg`));
    if (existing.every((f) => existsSync(f))) return { files: existing, clip: ptr.clip, version };
    const files = await extractKeyframes(this.ctx.config.tools.ffmpeg, this.store.abs(seriesId, ptr.clip), ptr.offset_sec, ptr.duration_sec, nFrames, dir, stem);
    return { files, clip: ptr.clip, version };
  }

  /** Record a human/Claude visual verdict on the latest QC result of a shot. */
  review(seriesId: string, n: number, shotId: string, verdict: { pass: boolean; reason: string; by: 'claude' | 'human' }): QcResultT {
    const ptr = this.latestPointer(seriesId, n, shotId);
    if (!ptr) throw new Error(`ช็อต ${shotId} ยังไม่มีคลิป`);
    const version = Number(/v(\d+)\.[a-z0-9]+$/.exec(ptr.clip)?.[1] ?? 1);
    const prev = this.loadResult(seriesId, n, shotId);
    const base = prev && prev.version === version ? prev : QcResult.parse({ shot_id: shotId, clip: ptr.clip, version, pass: true, checks: [], reasons: [], at: this.ctx.now() });
    const next = QcResult.parse({ ...base, review: verdict, at: this.ctx.now() });
    this.store.writeJson(this.qcFile(seriesId, n, shotId), next);
    this.ctx.log.info('review_shot', { series_id: seriesId, episode: n, shot_id: shotId, pass: verdict.pass, by: verdict.by });
    this.ctx.emit({ type: 'qc', series_id: seriesId, episode: n, shot_id: shotId });
    return next;
  }
}
