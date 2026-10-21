import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { planDubCues, type DubCue, type ValidationReport, type VoiceAdapter } from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { requirePreset } from '../context.js';
import { probeDuration, run } from '../util/ffmpeg.js';
import { getVoiceAdapter } from '../voice/index.js';
import { EpisodeService } from './episode.js';
import { SeriesService } from './series.js';

export interface DubResult {
  cues: Array<DubCue & { file: string; duration_sec: number; speed: number; fits: boolean }>;
  track: string;
  content_sec: number;
  report: ValidationReport;
  warnings: string[];
  provider: string;
  reused: number;
}

/**
 * Dub / narration (SPEC §8.8 M7): one voice per character for the whole episode, every cue
 * synthesized with identical settings, cached by (voice, text, speed), then placed on a silent
 * content-length track at the planned dialogue times -> edit/dub/voice_track.wav.
 */
export class VoiceService {
  private readonly series: SeriesService;
  private readonly episodes: EpisodeService;

  constructor(private readonly ctx: StudioContext) {
    this.series = new SeriesService(ctx);
    this.episodes = new EpisodeService(ctx);
  }

  dubDir(seriesId: string, n: number): string {
    return this.ctx.store.episodePath(seriesId, n, 'edit', 'dub');
  }

  trackFile(seriesId: string, n: number): string {
    return join(this.dubDir(seriesId, n), 'voice_track.wav');
  }

  plan(seriesId: string, n: number) {
    const series = this.series.load(seriesId);
    this.series.requireEpisode(series, n);
    const preset = requirePreset(this.ctx, series.style_id);
    const shots = this.episodes.loadShots(seriesId, n);
    const batches = this.episodes.loadBatches(seriesId, n);
    if (batches.length === 0) throw new Error(`ตอนที่ ${n} ยังไม่มี batch (compile_prompts ก่อน)`);
    const voices = this.series.loadVoices(seriesId);
    return { ...planDubCues(shots.shots, batches, preset.dialogue_mode, voices, 'th'), mode: preset.dialogue_mode };
  }

  async dub(seriesId: string, n: number, opts: { provider?: string | undefined; force?: boolean | undefined } = {}): Promise<DubResult> {
    const { cues, report, content_sec, mode } = this.plan(seriesId, n);
    const warnings: string[] = [];
    if (!report.ok) return { cues: [], track: '', content_sec, report, warnings, provider: opts.provider ?? this.ctx.config.voice.provider, reused: 0 };
    const adapter: VoiceAdapter = getVoiceAdapter(this.ctx, opts.provider);
    const dir = this.dubDir(seriesId, n);
    mkdirSync(dir, { recursive: true });
    const tools = this.ctx.config.tools;
    const vcfg = this.ctx.config.voice;
    const out: DubResult['cues'] = [];
    let reused = 0;
    for (const cue of cues) {
      const window = cue.end_sec - cue.start_sec;
      let speed = 1;
      let result = await this.synth(adapter, cue, speed, dir, opts.force === true);
      if (result.reused) reused++;
      if (result.duration_sec > window + vcfg.fit_tolerance_sec) {
        // too long for its slot: speak faster (bounded), then warn if it still spills over
        speed = Math.min(vcfg.max_speedup, Math.round((result.duration_sec / window) * 100) / 100);
        if (speed > 1) {
          result = await this.synth(adapter, cue, speed, dir, opts.force === true);
          if (result.reused) reused++;
        }
      }
      const fits = result.duration_sec <= window + vcfg.fit_tolerance_sec;
      if (!fits) warnings.push(`${cue.shot_id} "${cue.text}" ยาว ${result.duration_sec.toFixed(2)}s แต่ช่องเวลามี ${window.toFixed(2)}s (ล้น ${(result.duration_sec - window).toFixed(2)}s) — ยืด t_end หรือตัดบท`);
      out.push({ ...cue, file: this.ctx.store.rel(seriesId, result.file), duration_sec: result.duration_sec, speed, fits });
    }
    const track = await this.mix(seriesId, n, out, content_sec);
    const summary = { mode, provider: adapter.id, content_sec, cues: out, warnings, created_at: this.ctx.now() };
    this.ctx.store.writeJson(join(dir, 'dub.json'), summary);
    this.ctx.log.info('dubbed', { series_id: seriesId, episode: n, cues: out.length, provider: adapter.id, reused, warnings: warnings.length });
    this.ctx.emit({ type: 'dub', series_id: seriesId, episode: n });
    return { cues: out, track: this.ctx.store.rel(seriesId, track), content_sec, report, warnings, provider: adapter.id, reused };
  }

  private async synth(adapter: VoiceAdapter, cue: DubCue, speed: number, dir: string, force: boolean): Promise<{ file: string; duration_sec: number; reused: boolean }> {
    const key = createHash('sha1').update(`${adapter.id}|${cue.voice_id}|${cue.lang}|${speed}|${cue.text}`).digest('hex').slice(0, 16);
    const speakerDir = join(dir, cue.speaker);
    mkdirSync(speakerDir, { recursive: true });
    const file = join(speakerDir, `${key}.wav`);
    if (!force && existsSync(file)) return { file, duration_sec: await probeDuration(this.ctx.config.tools.ffprobe, file), reused: true };
    const r = await adapter.synthesize({ text: cue.text, voice_id: cue.voice_id, lang: cue.lang, speed, dest: file });
    return { file: r.file, duration_sec: r.duration_sec, reused: false };
  }

  /** Silent content-length track + every cue delayed to its start time. */
  private async mix(seriesId: string, n: number, cues: DubResult['cues'], contentSec: number): Promise<string> {
    const tools = this.ctx.config.tools;
    const dest = this.trackFile(seriesId, n);
    if (existsSync(dest)) this.ctx.store.moveToTrash(seriesId, dest);
    const args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-t', contentSec.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo'];
    const filters: string[] = [];
    cues.forEach((c, i) => {
      args.push('-i', this.ctx.store.abs(seriesId, c.file));
      const delay = Math.round(c.start_sec * 1000);
      filters.push(`[${i + 1}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,adelay=${delay}|${delay}[c${i}]`);
    });
    const inputs = ['[0:a]', ...cues.map((_, i) => `[c${i}]`)].join('');
    filters.push(`${inputs}amix=inputs=${cues.length + 1}:duration=first:normalize=0[out]`);
    args.push('-filter_complex', filters.join(';'), '-map', '[out]', '-ar', '48000', '-ac', '2', dest);
    const r = await run(tools.ffmpeg, args, { timeoutMs: 600_000 });
    if (r.code !== 0) throw new Error(`รวม voice track ไม่สำเร็จ: ${r.stderr.trim().slice(-600)}`);
    return dest;
  }
}
