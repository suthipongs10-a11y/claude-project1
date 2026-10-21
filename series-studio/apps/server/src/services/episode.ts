import { copyFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, isAbsolute, join, resolve } from 'node:path';
import {
  Batch,
  Continuity,
  Cost,
  Script,
  ShotList,
  compileBatchPrompt,
  planBatches,
  transitionEpisode,
  validateScript,
  validateShots,
  type Batch as BatchT,
  type GenJob,
  type Quality,
  type Script as ScriptT,
  type ShotList as ShotListT,
  type ValidationReport,
  type ScriptTiming,
} from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { requirePreset } from '../context.js';
import { engineConfig } from '../config.js';
import { getEngine } from '../engines/index.js';
import { SeriesService } from './series.js';

const CLIP_EXT = new Set(['.mp4', '.mov', '.webm', '.mkv']);

export interface ImportMapping {
  file: string;
  batch_id: string;
  job_id: string;
  stored: string;
  shot_ids: string[];
  how: 'filename:batch' | 'filename:job' | 'filename:shot' | 'order';
}

/** Per-episode pipeline: script -> shots -> batches/prompts -> jobs -> imported clips. */
export class EpisodeService {
  private readonly series: SeriesService;

  constructor(private readonly ctx: StudioContext) {
    this.series = new SeriesService(ctx);
  }

  private get store() {
    return this.ctx.store;
  }

  // ------------------------------------------------------------ script
  writeScript(seriesId: string, script: ScriptT): { report: ValidationReport; timing: ScriptTiming } {
    const series = this.series.load(seriesId);
    this.series.requireEpisode(series, script.episode);
    const bible = this.requireBible(seriesId);
    const { report, timing } = validateScript(script, series, bible, { syllablesPerSec: this.ctx.config.script.syllables_per_sec });
    if (!report.ok) return { report, timing };
    this.store.writeJson(this.store.episodePath(seriesId, script.episode, 'script.json'), Script.parse(script));
    const state = this.series.loadEpisodeState(seriesId, script.episode);
    if (state.status === 'planned') this.series.saveEpisodeState(seriesId, { ...state, status: transitionEpisode(state.status, 'scripted') });
    this.ctx.log.info('script_written', { series_id: seriesId, episode: script.episode, lines: script.lines.length, est_speech_sec: timing.est_speech_sec });
    return { report, timing };
  }

  loadScript(seriesId: string, n: number): ScriptT | undefined {
    return this.store.readJsonIfExists(this.store.episodePath(seriesId, n, 'script.json'), Script, 'script.json');
  }

  // ------------------------------------------------------------ shots
  writeShots(seriesId: string, list: ShotListT): { report: ValidationReport; batches_preview: ReturnType<typeof planBatches> } {
    const series = this.series.load(seriesId);
    this.series.requireEpisode(series, list.episode);
    const bible = this.requireBible(seriesId);
    const maxClipSec = engineConfig(this.ctx.config, series.engine_id).maxClipSec;
    const report = validateShots(list, {
      series,
      bible,
      continuity: this.loadContinuity(seriesId),
      outline: this.series.loadOutline(seriesId, list.episode),
      maxClipSec,
      knownStyles: new Set(this.ctx.presets.keys()),
      lengthTolerance: this.ctx.config.script.episode_length_tolerance,
    });
    if (!report.ok) return { report, batches_preview: [] };
    const parsed = ShotList.parse({ ...list, shots: list.shots.map((s) => ({ ...s, batch: null })) });
    this.store.writeJson(this.store.episodePath(seriesId, list.episode, 'shots.json'), parsed);
    // stale batches from a previous breakdown go to _trash
    const batchDir = this.store.episodePath(seriesId, list.episode, 'batches');
    for (const f of this.store.listFiles(batchDir, '.json')) this.store.moveToTrash(seriesId, join(batchDir, f));
    const state = this.series.loadEpisodeState(seriesId, list.episode);
    const status = state.status === 'planned' ? 'shots_ready' : state.status === 'scripted' || state.status === 'shots_ready' || state.status === 'prompts_ready' ? 'shots_ready' : state.status;
    if (status !== state.status) {
      const via = state.status === 'planned' ? transitionEpisode('scripted', 'shots_ready') : transitionEpisode(state.status, 'shots_ready');
      this.series.saveEpisodeState(seriesId, { ...state, status: via });
    }
    this.ctx.log.info('shots_written', { series_id: seriesId, episode: list.episode, shots: parsed.shots.length });
    this.ctx.emit({ type: 'shots', series_id: seriesId, episode: list.episode });
    return { report, batches_preview: planBatches(parsed.shots, maxClipSec) };
  }

  loadShots(seriesId: string, n: number): ShotListT {
    const file = this.store.episodePath(seriesId, n, 'shots.json');
    if (!this.store.exists(file)) throw new Error(`ตอนที่ ${n} ยังไม่มี shots.json (ใช้ write_shots)`);
    return this.store.readJson(file, ShotList, 'shots.json');
  }

  // ------------------------------------------------------------ batches + prompts
  compilePrompts(seriesId: string, n: number, opts: { fix_notes?: string | undefined } = {}): BatchT[] {
    const series = this.series.load(seriesId);
    this.series.requireEpisode(series, n);
    if (!series.gates.G2.approved) throw new Error('ต้องอนุมัติ G2 (ล็อก asset ครบ) ก่อน compile_prompts เพราะ prompt ต้องแนบภาพอ้างอิงที่ล็อกแล้ว');
    const preset = requirePreset(this.ctx, series.style_id);
    const bible = this.requireBible(seriesId);
    const list = this.loadShots(seriesId, n);
    const maxClipSec = engineConfig(this.ctx.config, series.engine_id).maxClipSec;
    const plan = planBatches(list.shots, maxClipSec);
    const wardrobeOverrides = this.wardrobeCarryOver(seriesId, n);
    const batches: BatchT[] = plan.map((b) => {
      const shots = b.shot_ids.map((id) => list.shots.find((s) => s.id === id)!);
      const compiled = compileBatchPrompt(shots, preset, series, bible, { presets: this.ctx.presets, fixNotes: opts.fix_notes, wardrobeOverrides });
      return Batch.parse({ id: b.id, episode: n, scene: b.scene, shot_ids: b.shot_ids, total_sec: b.total_sec, engine_id: series.engine_id, prompt: compiled.prompt, ref_images: compiled.ref_images });
    });
    const batchDir = this.store.episodePath(seriesId, n, 'batches');
    for (const f of this.store.listFiles(batchDir, '.json')) this.store.moveToTrash(seriesId, join(batchDir, f));
    for (const b of batches) this.store.writeJson(join(batchDir, `${b.id}.json`), b);
    const withBatch = ShotList.parse({ ...list, shots: list.shots.map((s) => ({ ...s, batch: batches.find((b) => b.shot_ids.includes(s.id))?.id ?? null })) });
    this.store.writeJson(this.store.episodePath(seriesId, n, 'shots.json'), withBatch);
    const state = this.series.loadEpisodeState(seriesId, n);
    if (state.status === 'shots_ready' || state.status === 'prompts_ready') this.series.saveEpisodeState(seriesId, { ...state, status: transitionEpisode(state.status, 'prompts_ready') });
    this.ctx.log.info('prompts_compiled', { series_id: seriesId, episode: n, batches: batches.length });
    this.ctx.emit({ type: 'shots', series_id: seriesId, episode: n });
    return batches;
  }

  loadBatches(seriesId: string, n: number): BatchT[] {
    const dir = this.store.episodePath(seriesId, n, 'batches');
    return this.store.listFiles(dir, '.json').map((f) => this.store.readJson(join(dir, f), Batch, `batches/${f}`));
  }

  /** Markdown + CSV prompt sheet for the manual engine (SPEC §9 export_prompt_sheet). */
  exportPromptSheet(seriesId: string, n: number, quality: Quality): { md: string; csv: string; files: string[] } {
    const series = this.series.load(seriesId);
    const batches = this.loadBatches(seriesId, n);
    if (batches.length === 0) throw new Error(`ตอนที่ ${n} ยังไม่มี batch (ใช้ compile_prompts ก่อน)`);
    const jobs = this.ctx.jobs.list({ series_id: seriesId, episode: n, kind: 'clip' });
    const md = [
      `# Prompt sheet — ${series.title} ตอนที่ ${n} (${series.aspect}, ${quality}, engine ${series.engine_id})`,
      '',
      `ตั้งค่าใน Flow: อัตราส่วน ${series.aspect}, คุณภาพ ${quality === 'draft' ? 'ต่ำสุด/480p' : 'สูงสุด'}, แนบภาพอ้างอิงตามรายการของแต่ละ batch`,
      `ตั้งชื่อไฟล์ที่ดาวน์โหลดให้มี batch id (เช่น \`${batches[0]?.id}.mp4\`) แล้ว import_clips จะจับคู่ให้เอง`,
      '',
      ...batches.flatMap((b) => {
        const job = jobs.filter((j) => j.batch_id === b.id && j.quality === quality).at(-1);
        return [
          `## ${b.id} — ${b.total_sec}s, shots: ${b.shot_ids.join(', ')}${job ? ` (job ${job.id}, ${job.status})` : ''}`,
          '',
          b.ref_images.length ? `แนบ refs: ${b.ref_images.map((r) => `\`${r}\``).join(', ')}` : 'ไม่มี ref ให้แนบ',
          '',
          '```',
          b.prompt,
          '```',
          '',
        ];
      }),
    ].join('\n');
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const csv = ['batch,shots,total_sec,aspect,quality,refs,prompt', ...batches.map((b) => [b.id, esc(b.shot_ids.join(' ')), String(b.total_sec), series.aspect, quality, esc(b.ref_images.join(' ')), esc(b.prompt)].join(','))].join('\n');
    const dir = this.store.episodePath(seriesId, n, 'edit');
    const mdFile = join(dir, `prompt_sheet_${quality}.md`);
    const csvFile = join(dir, `prompt_sheet_${quality}.csv`);
    this.store.writeText(mdFile, md + '\n');
    this.store.writeText(csvFile, csv + '\n');
    return { md, csv, files: [this.store.rel(seriesId, mdFile), this.store.rel(seriesId, csvFile)] };
  }

  // ------------------------------------------------------------ generate (jobs)
  async generate(seriesId: string, n: number, opts: { batch_ids?: string[] | undefined; quality: Quality; fix_notes?: string | undefined }): Promise<GenJob[]> {
    const series = this.series.load(seriesId);
    this.series.requireEpisode(series, n);
    const batches = this.loadBatches(seriesId, n);
    if (batches.length === 0) throw new Error(`ตอนที่ ${n} ยังไม่มี batch (ใช้ compile_prompts ก่อน)`);
    const wanted = opts.batch_ids?.length ? batches.filter((b) => opts.batch_ids!.includes(b.id)) : batches;
    const unknown = (opts.batch_ids ?? []).filter((id) => !batches.some((b) => b.id === id));
    if (unknown.length) throw new Error(`ไม่พบ batch: ${unknown.join(', ')}`);
    const engine = getEngine(this.ctx, series.engine_id);
    const credits = engineConfig(this.ctx.config, series.engine_id).creditsPerClip[opts.quality];
    const now = this.ctx.now();
    const jobs: GenJob[] = [];
    for (const b of wanted) {
      const prior = this.ctx.jobs.list({ series_id: seriesId, episode: n, kind: 'clip', batch_id: b.id });
      const attempt = prior.length + 1;
      const job = this.ctx.jobs.create({
        kind: 'clip',
        series_id: seriesId,
        episode: n,
        batch_id: b.id,
        shot_ids: b.shot_ids,
        quality: opts.quality,
        engine_id: series.engine_id,
        status: 'queued',
        attempt,
        prompt: b.prompt,
        ref_images: b.ref_images,
        ...(opts.fix_notes ? { fix_notes: opts.fix_notes } : {}),
        cost_credits: credits,
        created_at: now,
        updated_at: now,
      });
      await engine.submit(job);
      const polled = await engine.poll({ jobId: job.id });
      jobs.push(polled.status === job.status ? this.ctx.jobs.get(job.id)! : this.ctx.jobs.update(job.id, { status: polled.status, updated_at: now }));
    }
    this.addCost(seriesId, n, credits * jobs.length, jobs.length);
    const state = this.series.loadEpisodeState(seriesId, n);
    if (state.status === 'prompts_ready' || state.status === 'qc' || state.status === 'generating') this.series.saveEpisodeState(seriesId, { ...state, status: transitionEpisode(state.status, 'generating') });
    this.ctx.log.info('generate', { series_id: seriesId, episode: n, jobs: jobs.length, quality: opts.quality, engine: series.engine_id });
    this.ctx.emit({ type: 'jobs', series_id: seriesId, episode: n });
    return jobs;
  }

  // ------------------------------------------------------------ import clips (manual engine)
  importClips(seriesId: string, n: number, opts: { folder?: string | undefined; files?: string[] | undefined }): { mapped: ImportMapping[]; unmatched: string[]; warnings: string[] } {
    const series = this.series.load(seriesId);
    this.series.requireEpisode(series, n);
    const batches = this.loadBatches(seriesId, n);
    if (batches.length === 0) throw new Error(`ตอนที่ ${n} ยังไม่มี batch (ใช้ compile_prompts ก่อน)`);
    const files = this.collectFiles(opts);
    if (files.length === 0) throw new Error('ไม่พบไฟล์วิดีโอ (.mp4/.mov/.webm/.mkv) ที่จะนำเข้า');
    const awaiting = this.ctx.jobs.list({ series_id: seriesId, episode: n, kind: 'clip', status: ['awaiting_import', 'queued'] });
    const warnings: string[] = [];
    const mapped: ImportMapping[] = [];
    const unmatched: string[] = [];
    const used = new Set<string>();
    const byOrder: string[] = [];
    for (const file of files) {
      const name = basename(file).toLowerCase();
      let job: GenJob | undefined;
      let how: ImportMapping['how'] | undefined;
      const jobHit = awaiting.find((j) => !used.has(j.id) && name.includes(j.id.toLowerCase()));
      if (jobHit) {
        job = jobHit;
        how = 'filename:job';
      } else {
        const batchHit = batches.find((b) => new RegExp(`(^|[^a-z0-9])${b.id}([^a-z0-9]|$)`).test(name));
        if (batchHit) {
          job = awaiting.find((j) => !used.has(j.id) && j.batch_id === batchHit.id);
          how = 'filename:batch';
          if (!job) warnings.push(`${basename(file)} ระบุ ${batchHit.id} แต่ไม่มีงานที่รอ import ของ batch นี้ (ใช้ generate ก่อน หรือเป็นไฟล์ซ้ำ)`);
        } else {
          const shotHit = batches.find((b) => b.shot_ids.some((id) => name.includes(id.toLowerCase())));
          if (shotHit) {
            job = awaiting.find((j) => !used.has(j.id) && j.batch_id === shotHit.id);
            how = 'filename:shot';
          } else byOrder.push(file);
        }
      }
      if (job && how) {
        used.add(job.id);
        mapped.push(this.storeClip(seriesId, n, file, job, how));
      } else if (!byOrder.includes(file)) unmatched.push(file);
    }
    // files without any id in their name: assign to remaining awaiting jobs in batch order
    const remaining = awaiting.filter((j) => !used.has(j.id)).sort((a, b) => (a.batch_id ?? '').localeCompare(b.batch_id ?? ''));
    for (const file of byOrder) {
      const job = remaining.shift();
      if (!job) {
        unmatched.push(file);
        continue;
      }
      used.add(job.id);
      warnings.push(`${basename(file)} ไม่มี batch id ในชื่อไฟล์ จับคู่ตามลำดับให้ ${job.batch_id} — ตรวจว่าถูกต้อง`);
      mapped.push(this.storeClip(seriesId, n, file, job, 'order'));
    }
    this.maybeEnterQc(seriesId, n, mapped.length > 0);
    this.ctx.log.info('import_clips', { series_id: seriesId, episode: n, mapped: mapped.length, unmatched: unmatched.length });
    this.ctx.emit({ type: 'jobs', series_id: seriesId, episode: n });
    return { mapped, unmatched, warnings };
  }

  /** Store a finished clip for a job (manual import or extension upload) and write per-shot pointers. */
  attachClip(seriesId: string, n: number, job: GenJob, file: string): string {
    return this.storeClip(seriesId, n, file, job, 'order').stored;
  }

  private storeClip(seriesId: string, n: number, file: string, job: GenJob, how: ImportMapping['how']): ImportMapping {
    const ext = extname(file).toLowerCase() || '.mp4';
    const dest = this.store.episodePath(seriesId, n, 'gen', job.batch_id!, `v${job.attempt}${ext}`);
    if (existsSync(dest)) this.store.moveToTrash(seriesId, dest);
    this.store.writeText(dest + '.meta.json', JSON.stringify({ job_id: job.id, source: basename(file), imported_at: this.ctx.now() }, null, 2) + '\n');
    copyFileSync(file, dest);
    const rel = this.store.rel(seriesId, dest);
    this.ctx.jobs.update(job.id, { status: 'done', output: rel, updated_at: this.ctx.now() });
    // per-shot pointers so QC/assembly can find the clip and its planned offsets
    const shots = this.loadShots(seriesId, n);
    let offset = 0;
    for (const id of job.shot_ids) {
      const shot = shots.shots.find((s) => s.id === id);
      const dur = shot?.duration_sec ?? 0;
      this.store.writeJson(this.store.episodePath(seriesId, n, 'gen', id, `v${job.attempt}.json`), { shot_id: id, clip: rel, offset_sec: Math.round(offset * 10) / 10, duration_sec: dur, job_id: job.id, batch_id: job.batch_id });
      offset += dur;
    }
    return { file, batch_id: job.batch_id!, job_id: job.id, stored: rel, shot_ids: job.shot_ids, how };
  }

  /** When no clip job is outstanding any more, the episode moves from generating to qc. */
  maybeEnterQc(seriesId: string, n: number, imported = true): void {
    const stillWaiting = this.ctx.jobs.list({ series_id: seriesId, episode: n, kind: 'clip', status: ['awaiting_import', 'queued', 'running'] });
    if (imported && stillWaiting.length === 0) {
      const state = this.series.loadEpisodeState(seriesId, n);
      if (state.status === 'generating') this.series.saveEpisodeState(seriesId, { ...state, status: transitionEpisode(state.status, 'qc') });
    }
  }

  private collectFiles(opts: { folder?: string | undefined; files?: string[] | undefined }): string[] {
    const out: string[] = [];
    const absOf = (p: string) => (isAbsolute(p) ? p : resolve(process.cwd(), p));
    if (opts.folder) {
      const dir = absOf(opts.folder);
      if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error(`ไม่พบโฟลเดอร์: ${opts.folder}`);
      for (const f of readdirSync(dir).sort()) if (CLIP_EXT.has(extname(f).toLowerCase())) out.push(join(dir, f));
    }
    for (const f of opts.files ?? []) {
      const abs = absOf(f);
      if (!existsSync(abs) || !statSync(abs).isFile()) throw new Error(`ไม่พบไฟล์: ${f}`);
      if (!CLIP_EXT.has(extname(abs).toLowerCase())) throw new Error(`ไม่ใช่ไฟล์วิดีโอ: ${f}`);
      out.push(abs);
    }
    return [...new Set(out)];
  }

  // ------------------------------------------------------------ helpers
  requireBible(seriesId: string) {
    const bible = this.series.loadBible(seriesId);
    if (!bible) throw new Error(`ซีรีส์ "${seriesId}" ยังไม่มี bible (ใช้ write_bible ก่อน)`);
    return bible;
  }

  loadContinuity(seriesId: string) {
    return this.store.readJsonIfExists(join(this.store.seriesDir(seriesId), 'continuity.json'), Continuity, 'continuity.json') ?? Continuity.parse({});
  }

  /** Wardrobe each character wears at the end of the previous episode (continuity carry-over). */
  wardrobeCarryOver(seriesId: string, n: number): Record<string, string> {
    const entry = this.loadContinuity(seriesId).entries.find((e) => e.after_episode === n - 1);
    const out: Record<string, string> = {};
    if (entry) for (const [id, st] of Object.entries(entry.states)) if (st.wardrobe) out[id] = st.wardrobe;
    return out;
  }

  addCost(seriesId: string, n: number, credits: number, jobs: number): void {
    const file = join(this.store.seriesDir(seriesId), 'cost.json');
    const cost = this.store.readJsonIfExists(file, Cost, 'cost.json') ?? Cost.parse({});
    const key = String(n);
    const cur = cost.episodes[key] ?? { credits: 0, jobs: 0 };
    cost.episodes[key] = { credits: cur.credits + credits, jobs: cur.jobs + jobs };
    cost.total_credits += credits;
    this.store.writeJson(file, cost);
  }
}
