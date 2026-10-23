import { existsSync, mkdirSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { codeRoot } from '../config.js';
import {
  Timeline,
  transitionEpisode,
  type Aspect,
  type Quality,
  type SubtitleCue,
  type Timeline as TimelineT,
  type TimelineSegment,
} from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { requirePreset } from '../context.js';
import { extractFrame, hasAudio, measureLoudness, probeDuration, run } from '../util/ffmpeg.js';
import { assStyle, toSrt } from '../util/subtitles.js';
import { EpisodeService } from './episode.js';
import { QcService } from './qc.js';
import { SeriesService } from './series.js';

export interface AssembleOptions {
  quality: Quality;
  aspect?: Aspect | undefined;
  /** Background music file (absolute, or relative to the series folder). Ducked under speech. */
  music?: string | undefined;
  /** Voice track aligned to the first clip (dub/narration output of M7). Replaces clip audio. */
  voice_track?: string | undefined;
  burn_subtitles?: boolean | undefined;
  cards?: boolean | undefined;
  ai_label?: boolean | undefined;
}

export interface AssembleResult {
  timeline: TimelineT;
  video: string;
  srt?: string;
  cover?: string;
  warnings: string[];
  loudness_lufs?: number;
}

const RES: Record<Aspect, { w: number; h: number }> = { '9:16': { w: 1080, h: 1920 }, '16:9': { w: 1920, h: 1080 } };

/** Escape a value for use inside an ffmpeg filtergraph option. */
export function ffEscape(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/,/g, '\\,').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

/** Escape a file path for a filtergraph option: forward slashes (Windows-safe) plus the special characters. */
export function ffPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

/** Resolve a config path against the studio root, then the code root (fonts ship with the code). */
export function resolveStudioFile(root: string, rel: string): string | undefined {
  if (isAbsolute(rel)) return existsSync(rel) ? rel : undefined;
  for (const base of [root, codeRoot()]) {
    const abs = resolve(base, rel);
    if (existsSync(abs)) return abs;
  }
  return undefined;
}

/** SPEC §8.8 assembly with ffmpeg: concat, cards, labels, subtitles, two-pass loudnorm, export. */
export class AssemblyService {
  private readonly series: SeriesService;
  private readonly episodes: EpisodeService;
  private readonly qc: QcService;

  constructor(private readonly ctx: StudioContext) {
    this.series = new SeriesService(ctx);
    this.episodes = new EpisodeService(ctx);
    this.qc = new QcService(ctx);
  }

  private get store() {
    return this.ctx.store;
  }

  async assemble(seriesId: string, n: number, opts: AssembleOptions): Promise<AssembleResult> {
    const series = this.series.load(seriesId);
    this.series.requireEpisode(series, n);
    const preset = requirePreset(this.ctx, series.style_id);
    const cfg = this.ctx.config.assembly;
    const tools = this.ctx.config.tools;
    const state = this.series.loadEpisodeState(seriesId, n);
    if (opts.quality === 'final' && !state.gates.G3.approved) throw new Error(`ตอนที่ ${n} ยังไม่ผ่าน G3 (อนุมัติดราฟต์) ใช้ quality "draft" เพื่อดูตัวอย่าง หรือ approve_gate G3 ก่อน`);
    // dub/narration presets: use the dub track from dub_episode when present and no explicit track was given
    const autoTrack = this.store.episodePath(seriesId, n, 'edit', 'dub', 'voice_track.wav');
    if (!opts.voice_track && (preset.dialogue_mode === 'dub' || preset.dialogue_mode === 'narration') && existsSync(autoTrack)) opts = { ...opts, voice_track: autoTrack };
    const list = this.episodes.loadShots(seriesId, n);
    const batches = this.episodes.loadBatches(seriesId, n).sort((a, b) => a.id.localeCompare(b.id));
    if (batches.length === 0) throw new Error(`ตอนที่ ${n} ยังไม่มี batch (compile_prompts ก่อน)`);
    const outline = this.series.loadOutline(seriesId, n);
    const nextOutline = n < series.episodes ? this.series.loadOutline(seriesId, n + 1) : undefined;
    const aspect = opts.aspect ?? series.aspect;
    const scale = opts.quality === 'draft' ? cfg.draft_scale : 1;
    const W = Math.round((RES[aspect].w * scale) / 2) * 2;
    const H = Math.round((RES[aspect].h * scale) / 2) * 2;
    const fps = cfg.fps;
    const warnings: string[] = [];
    const cards = opts.cards ?? true;
    const epTag = `ep${String(n).padStart(2, '0')}`;
    const editDir = this.store.episodePath(seriesId, n, 'edit');
    const outDir = opts.quality === 'final' ? this.store.episodePath(seriesId, n, 'final') : editDir;
    mkdirSync(join(editDir, '_cards'), { recursive: true });
    mkdirSync(outDir, { recursive: true });

    // ------------------------------------------------------------ timeline
    const segments: TimelineSegment[] = [];
    const cues: SubtitleCue[] = [];
    let t = 0;
    const epTitle = outline?.title ? `ตอนที่ ${n}: ${outline.title}` : `ตอนที่ ${n}`;
    if (cards && cfg.title_card_sec > 0) {
      segments.push({ kind: 'card', id: 'title', in_sec: 0, out_sec: cfg.title_card_sec, start_sec: t, shot_ids: [], notes: [] });
      t += cfg.title_card_sec;
    }
    const contentStart = t;
    for (const b of batches) {
      const firstShot = b.shot_ids[0]!;
      const ptr = this.qc.latestPointer(seriesId, n, firstShot);
      if (!ptr) throw new Error(`batch ${b.id} ยังไม่มีคลิป (import_clips ก่อน)`);
      const abs = this.store.abs(seriesId, ptr.clip);
      if (!existsSync(abs)) throw new Error(`ไม่พบไฟล์คลิป ${ptr.clip}`);
      const version = Number(/v(\d+)\.[a-z0-9]+$/.exec(ptr.clip)?.[1] ?? 1);
      const dur = await probeDuration(tools.ffprobe, abs);
      const notes: string[] = [];
      let out = b.total_sec;
      if (dur + 0.05 < b.total_sec) {
        notes.push(`คลิปยาว ${dur.toFixed(2)}s สั้นกว่าที่วาง ${b.total_sec}s ใช้เท่าที่มี`);
        out = Math.round(dur * 1000) / 1000;
      }
      for (const sid of b.shot_ids) {
        const r = this.qc.loadResult(seriesId, n, sid);
        if (r && !r.pass && !r.review?.pass) notes.push(`ช็อต ${sid} ยังไม่ผ่าน QC`);
      }
      segments.push({ kind: 'clip', id: b.id, clip: ptr.clip, version, in_sec: 0, out_sec: out, start_sec: t, shot_ids: b.shot_ids, notes });
      warnings.push(...notes.map((x) => `${b.id}: ${x}`));
      // subtitles from planned dialogue timing
      let off = 0;
      for (const sid of b.shot_ids) {
        const shot = list.shots.find((s) => s.id === sid);
        if (!shot) continue;
        for (const d of shot.dialogue) {
          const start = t + off + d.t_start;
          const end = Math.min(t + off + d.t_end, t + out);
          if (end <= start) continue;
          cues.push({ index: cues.length + 1, start_sec: round3(start), end_sec: round3(end), char: d.char, text: d.text, shot_id: sid });
        }
        off += shot.duration_sec;
      }
      t += out;
    }
    const contentEnd = t;
    const isBridgeEpisode = !!series.product && series.product.bridge_episodes.includes(n);
    if (cards && isBridgeEpisode && cfg.product_card_sec > 0) {
      segments.push({ kind: 'card', id: 'product', in_sec: 0, out_sec: cfg.product_card_sec, start_sec: t, shot_ids: [], notes: [] });
      t += cfg.product_card_sec;
    }
    if (cards && cfg.end_card_sec > 0) {
      segments.push({ kind: 'card', id: 'end', in_sec: 0, out_sec: cfg.end_card_sec, start_sec: t, shot_ids: [], notes: [] });
      t += cfg.end_card_sec;
    }
    const total = round3(t);

    // ------------------------------------------------------------ ffmpeg graph
    const args: string[] = ['-hide_banner', '-loglevel', 'error', '-y'];
    const filters: string[] = [];
    let inputIdx = 0;
    const addInput = (...a: string[]) => {
      args.push(...a);
      return inputIdx++;
    };
    const cardText = (id: string, lines: string[]) => {
      const file = join(editDir, '_cards', `${id}.txt`);
      this.store.writeText(file, lines.join('\n'));
      return file;
    };
    const fontFile = resolveStudioFile(this.ctx.config.root, cfg.font_file);
    const fontsDir = resolveStudioFile(this.ctx.config.root, cfg.fonts_dir);
    // drawtext: a bundled TTF needs no fontconfig (which is missing on Windows builds of ffmpeg)
    const fontSpec = fontFile ? `fontfile='${ffPath(fontFile)}'` : `font='${ffEscape(cfg.card_font)}'`;
    if (!fontFile) warnings.push(`ไม่พบไฟล์ฟอนต์ ${cfg.font_file} ใช้ฟอนต์ของระบบ "${cfg.card_font}" แทน (บน Windows อาจเรนเดอร์ไม่ได้)`);
    const videoLabels: string[] = [];
    const audioLabels: string[] = [];
    for (const [i, seg] of segments.entries()) {
      const T = seg.out_sec - seg.in_sec;
      if (seg.kind === 'card') {
        const vi = addInput('-f', 'lavfi', '-t', T.toFixed(3), '-i', `color=c=0x0e0e12:s=${W}x${H}:r=${fps}`);
        const ai = addInput('-f', 'lavfi', '-t', T.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo');
        const big = Math.round(H * 0.045);
        const small = Math.round(H * 0.028);
        let text: string;
        if (seg.id === 'title') {
          text = `[${vi}:v]drawtext=textfile='${ffPath(cardText('title', [series.title]))}':${fontSpec}:fontsize=${big}:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-${Math.round(H * 0.04)},drawtext=textfile='${ffPath(cardText('title2', [epTitle]))}':${fontSpec}:fontsize=${small}:fontcolor=0xdddddd:x=(w-text_w)/2:y=(h-text_h)/2+${Math.round(H * 0.03)}`;
        } else if (seg.id === 'product' && series.product) {
          const p = series.product;
          text = `[${vi}:v]drawtext=textfile='${ffPath(cardText('product', [p.name]))}':${fontSpec}:fontsize=${big}:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-${Math.round(H * 0.09)},drawtext=textfile='${ffPath(cardText('product2', p.selling_points.map((s) => `• ${s}`)))}':${fontSpec}:fontsize=${small}:fontcolor=0xdddddd:x=(w-text_w)/2:y=(h-text_h)/2,drawtext=textfile='${ffPath(cardText('product3', [p.cta]))}':${fontSpec}:fontsize=${small}:fontcolor=0xffd166:x=(w-text_w)/2:y=(h-text_h)/2+${Math.round(H * 0.1)}`;
        } else {
          const next = nextOutline ? `ตอนต่อไป: ${nextOutline.title}` : n < series.episodes ? 'ตอนต่อไป โปรดติดตาม' : 'จบบริบูรณ์ ขอบคุณที่รับชม';
          text = `[${vi}:v]drawtext=textfile='${ffPath(cardText('end', [next]))}':${fontSpec}:fontsize=${big}:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2`;
        }
        filters.push(`${text},fps=${fps},format=yuv420p[v${i}]`);
        filters.push(`[${ai}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a${i}]`);
      } else {
        const abs = this.store.abs(seriesId, seg.clip!);
        const vi = addInput('-i', abs);
        filters.push(
          `[${vi}:v]trim=start=${seg.in_sec}:end=${seg.out_sec},setpts=PTS-STARTPTS,scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},format=yuv420p[v${i}]`,
        );
        if (await hasAudio(tools.ffprobe, abs)) {
          filters.push(`[${vi}:a]atrim=start=${seg.in_sec}:end=${seg.out_sec},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,apad=whole_dur=${T.toFixed(3)}[a${i}]`);
        } else {
          const ai = addInput('-f', 'lavfi', '-t', T.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo');
          filters.push(`[${ai}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a${i}]`);
          if (!warnings.includes(`${seg.id}: คลิปไม่มีเสียง`)) warnings.push(`${seg.id}: คลิปไม่มีเสียง`);
        }
      }
      videoLabels.push(`[v${i}]`);
      audioLabels.push(`[a${i}]`);
    }
    filters.push(`${segments.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${segments.length}:v=1:a=1[vcat][acat]`);

    // overlays: AI label (always-on, small) and ad label in product mode
    let vLabel = 'vcat';
    const overlays: string[] = [];
    if (opts.ai_label ?? true) {
      const pos = cfg.ai_label_position;
      const x = pos.endsWith('right') ? 'w-text_w-24' : '24';
      const y = pos.startsWith('bottom') ? 'h-text_h-24' : '24';
      overlays.push(`drawtext=textfile='${ffPath(cardText('ai_label', [cfg.ai_label_text]))}':${fontSpec}:fontsize=${Math.round(H * 0.016)}:fontcolor=white@0.75:box=1:boxcolor=black@0.35:boxborderw=8:x=${x}:y=${y}`);
    }
    if (series.product) {
      overlays.push(`drawtext=textfile='${ffPath(cardText('ad_label', [cfg.ad_label_text]))}':${fontSpec}:fontsize=${Math.round(H * 0.018)}:fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=8:x=24:y=24:enable='between(t,${contentStart},${contentEnd})'`);
    }
    // subtitles
    let srtPath: string | undefined;
    if (cues.length) {
      srtPath = join(outDir, `${epTag}.srt`);
      this.store.writeText(srtPath, toSrt(cues));
      if (opts.burn_subtitles ?? true) {
        overlays.push(`subtitles='${ffPath(srtPath)}'${fontsDir ? `:fontsdir='${ffPath(fontsDir)}'` : ''}:force_style='${assStyle(preset.subtitle_style, cfg.subtitle_font, aspect, scale)}'`);
      }
    }
    if (overlays.length) {
      filters.push(`[vcat]${overlays.join(',')}[vout]`);
      vLabel = 'vout';
    }

    // audio: clips | voice track, optional music with ducking
    let aLabel = 'acat';
    const audioSource: TimelineT['audio']['source'] = opts.voice_track ? 'voice_track' : 'clips';
    const resolveMedia = (p: string) => (isAbsolute(p) ? p : existsSync(this.store.abs(seriesId, p)) ? this.store.abs(seriesId, p) : resolve(process.cwd(), p));
    if (!opts.voice_track && (preset.dialogue_mode === 'dub' || preset.dialogue_mode === 'narration')) warnings.push(`preset ใช้โหมด ${preset.dialogue_mode} แต่ยังไม่มี voice track (ใช้ dub_episode ก่อน) — ใช้เสียงจากคลิปแทน`);
    if (opts.voice_track) {
      const vt = resolveMedia(opts.voice_track);
      if (!existsSync(vt)) throw new Error(`ไม่พบ voice track: ${opts.voice_track}`);
      const vi = addInput('-i', vt);
      const delayMs = Math.round(contentStart * 1000);
      filters.push(`[${vi}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,adelay=${delayMs}|${delayMs},apad,atrim=0:${total}[voice]`);
      filters.push('[acat]anullsink'); // clip audio is replaced by the voice track
      aLabel = 'voice';
    }
    if (opts.music) {
      const mp = resolveMedia(opts.music);
      if (!existsSync(mp)) throw new Error(`ไม่พบไฟล์เพลง: ${opts.music}`);
      const mi = addInput('-stream_loop', '-1', '-i', mp);
      filters.push(`[${mi}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,atrim=0:${total},asetpts=PTS-STARTPTS,volume=${cfg.music_volume}[music]`);
      filters.push(`[${aLabel}]asplit=2[spk][sc]`);
      filters.push(`[music][sc]sidechaincompress=threshold=0.015:ratio=8:attack=40:release=500:makeup=1[ducked]`);
      filters.push(`[spk][ducked]amix=inputs=2:duration=first:normalize=0[amixed]`);
      aLabel = 'amixed';
    }

    const rawFile = join(editDir, `_raw_${opts.quality}_${aspect.replace(':', 'x')}.mp4`);
    args.push('-filter_complex', filters.join(';'), '-map', `[${vLabel}]`, '-map', `[${aLabel}]`, '-c:v', 'libx264', '-crf', String(cfg.crf), '-preset', cfg.x264_preset, '-pix_fmt', 'yuv420p', '-r', String(fps), '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', String(total), rawFile);
    const started = Date.now();
    const r1 = await run(tools.ffmpeg, args, { timeoutMs: 3_600_000 });
    if (r1.code !== 0) throw new Error(`ffmpeg ประกอบตอนไม่สำเร็จ: ${r1.stderr.trim().slice(-1200)}`);

    // two-pass loudnorm to the social target
    const stats = await measureLoudness(tools.ffmpeg, rawFile, cfg.loudness_lufs);
    const outName = opts.quality === 'final' ? `${epTag}_${aspect.replace(':', 'x')}.mp4` : `preview_${epTag}_${aspect.replace(':', 'x')}.mp4`;
    const outFile = join(outDir, outName);
    if (existsSync(outFile)) this.store.moveToTrash(seriesId, outFile);
    const ln = `loudnorm=I=${cfg.loudness_lufs}:TP=-1.5:LRA=11:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true,aresample=48000`;
    const r2 = await run(tools.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', rawFile, '-c:v', 'copy', '-af', ln, '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', outFile], { timeoutMs: 1_800_000 });
    if (r2.code !== 0) throw new Error(`loudnorm ไม่สำเร็จ: ${r2.stderr.trim().slice(-800)}`);
    this.store.moveToTrash(seriesId, rawFile);

    // cover: mid-point of the last (cliffhanger) shot
    let cover: string | undefined;
    const lastClip = [...segments].reverse().find((s) => s.kind === 'clip');
    if (lastClip) {
      const lastShot = list.shots.find((s) => s.id === lastClip.shot_ids.at(-1));
      const lastDur = lastShot?.duration_sec ?? lastClip.out_sec - lastClip.in_sec;
      const tCover = Math.min(lastClip.start_sec + (lastClip.out_sec - lastClip.in_sec) - lastDur / 2, total - 0.1);
      cover = join(outDir, `${epTag}_cover.jpg`);
      await extractFrame(tools.ffmpeg, outFile, Math.max(0, tCover), cover, W);
    }

    const timeline = Timeline.parse({
      episode: n,
      quality: opts.quality,
      aspect,
      width: W,
      height: H,
      fps,
      total_sec: total,
      segments,
      subtitles: cues,
      audio: { source: audioSource, ...(opts.voice_track ? { voice_track: this.relOrAbs(seriesId, resolveMedia(opts.voice_track)) } : {}), ...(opts.music ? { music: this.relOrAbs(seriesId, resolveMedia(opts.music)) } : {}), loudness_lufs: cfg.loudness_lufs, measured: { input_i: stats.input_i, input_tp: stats.input_tp, input_lra: stats.input_lra } },
      outputs: { video: this.store.rel(seriesId, outFile), ...(srtPath ? { srt: this.store.rel(seriesId, srtPath) } : {}), ...(cover ? { cover: this.store.rel(seriesId, cover) } : {}) },
      created_at: this.ctx.now(),
    });
    this.store.writeJson(join(editDir, `timeline_${opts.quality}.json`), timeline);
    if (opts.quality === 'final') {
      const st = this.series.loadEpisodeState(seriesId, n);
      if (st.status === 'draft_approved') this.series.saveEpisodeState(seriesId, { ...st, status: transitionEpisode(st.status, 'assembling') });
    }
    this.ctx.log.info('assembled', { series_id: seriesId, episode: n, quality: opts.quality, aspect, total_sec: total, ms: Date.now() - started, warnings: warnings.length });
    this.ctx.emit({ type: 'assembled', series_id: seriesId, episode: n, quality: opts.quality });
    return { timeline, video: outFile, ...(srtPath ? { srt: srtPath } : {}), ...(cover ? { cover } : {}), warnings };
  }

  private relOrAbs(seriesId: string, abs: string): string {
    const base = this.store.seriesDir(seriesId);
    return abs.startsWith(base) ? this.store.rel(seriesId, abs) : abs.replace(/^\/+/, '');
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
