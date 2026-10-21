import { readFileSync, existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { parseOrThrow, type EngineConfig } from '@series-studio/core';

const EngineConfigSchema = z.strictObject({
  maxClipSec: z.number().positive(),
  supportsRefImages: z.boolean(),
  supportsNativeDialogue: z.boolean(),
  creditsPerClip: z.strictObject({ draft: z.number().nonnegative(), final: z.number().nonnegative() }),
  minDelayMs: z.int().nonnegative().optional(),
  maxDelayMs: z.int().nonnegative().optional(),
});

export const StudioConfigSchema = z.strictObject({
  $comment: z.string().optional(),
  projects_dir: z.string().min(1),
  presets_dir: z.string().min(1),
  logs_dir: z.string().min(1),
  data_dir: z.string().min(1),
  tools: z.strictObject({ python: z.string().min(1), ffmpeg: z.string().min(1), ffprobe: z.string().min(1) }),
  http: z.strictObject({ host: z.literal('127.0.0.1'), port: z.int().min(1).max(65535) }),
  default_engine: z.string().min(1),
  engines: z.record(z.string(), EngineConfigSchema),
  qc: z.strictObject({
    duration_tolerance: z.number().min(0).max(1),
    cut_tolerance: z.int().min(0),
    cer_max: z.number().min(0).max(1),
    identity_similarity_min: z.number().min(0).max(1),
    black_min_sec: z.number().positive(),
    freeze_min_sec: z.number().positive(),
    max_regen_attempts: z.int().min(0),
    keyframes_per_shot: z.int().min(1),
    scdet_threshold: z.number().min(0).max(100),
    worker_timeout_sec: z.int().min(1),
    whisper_model: z.string().min(1),
    whisper_device: z.string().min(1),
    whisper_compute_type: z.string().min(1),
    ocr: z.boolean(),
  }),
  script: z.strictObject({
    syllables_per_sec: z.number().positive(),
    episode_length_tolerance: z.number().min(0).max(1),
  }),
  assembly: z.strictObject({
    loudness_lufs: z.number(),
    subtitle_offset_tolerance_sec: z.number().positive(),
    ai_label_text: z.string().min(1),
    ad_label_text: z.string().min(1),
  }),
});
export type StudioConfig = z.infer<typeof StudioConfigSchema>;

/** Resolved config: every *_dir is an absolute path. */
export interface ResolvedConfig extends StudioConfig {
  root: string;
  projects_dir: string;
  presets_dir: string;
  logs_dir: string;
  data_dir: string;
}

/** The checked-out series-studio code folder (contains apps/, packages/, workers/). */
export function codeRoot(): string {
  // <root>/apps/server/{src|dist}/config.ts -> <root>
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', '..', '..');
}

/** The data/config root: SERIES_STUDIO_HOME or the code folder. */
export function studioRoot(): string {
  const env = process.env['SERIES_STUDIO_HOME'];
  if (env) return resolve(env);
  return codeRoot();
}

function deepMerge(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && b && typeof b === 'object' && !Array.isArray(b)) {
      out[k] = deepMerge(b as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export interface LoadConfigOptions {
  root?: string;
  /** Explicit config path; defaults to <root>/config/studio.json (+ local.json overrides). */
  configPath?: string;
}

export function loadConfig(opts: LoadConfigOptions = {}): ResolvedConfig {
  const root = opts.root ?? studioRoot();
  const path = opts.configPath ?? process.env['SERIES_STUDIO_CONFIG'] ?? resolve(root, 'config', 'studio.json');
  if (!existsSync(path)) throw new Error(`ไม่พบไฟล์ config: ${path}`);
  let raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const localPath = resolve(dirname(path), 'local.json');
  if (existsSync(localPath)) {
    raw = deepMerge(raw, JSON.parse(readFileSync(localPath, 'utf8')) as Record<string, unknown>);
  }
  const cfg = parseOrThrow(StudioConfigSchema, raw, 'config');
  if (!cfg.engines[cfg.default_engine]) {
    throw new Error(`config: default_engine "${cfg.default_engine}" ไม่มีใน engines`);
  }
  const abs = (p: string) => (isAbsolute(p) ? p : resolve(root, p));
  return {
    ...cfg,
    root,
    projects_dir: abs(cfg.projects_dir),
    presets_dir: abs(cfg.presets_dir),
    logs_dir: abs(cfg.logs_dir),
    data_dir: abs(cfg.data_dir),
  };
}

export function engineConfig(cfg: StudioConfig, engineId: string): EngineConfig {
  const e = cfg.engines[engineId];
  if (!e) throw new Error(`ไม่รู้จัก engine "${engineId}" (มีใน config: ${Object.keys(cfg.engines).join(', ')})`);
  return e;
}
