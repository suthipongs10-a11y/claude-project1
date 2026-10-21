import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StudioContext } from '../context.js';

/** User-editable settings (SPEC §11 screen 7). Stored as config/local.json overrides; the server re-reads on restart. */
export interface Settings {
  default_engine: string;
  export_dir: string;
  qc: Partial<Pick<StudioContext['config']['qc'], 'duration_tolerance' | 'cut_tolerance' | 'cer_max' | 'identity_similarity_min' | 'max_regen_attempts' | 'black_min_sec' | 'freeze_min_sec'>>;
  assembly: Partial<Pick<StudioContext['config']['assembly'], 'loudness_lufs' | 'subtitle_font' | 'card_font' | 'music_volume'>>;
  tools: Partial<StudioContext['config']['tools']>;
  voice: Partial<Pick<StudioContext['config']['voice'], 'provider' | 'max_speedup' | 'fit_tolerance_sec'>>;
}

export class SettingsService {
  constructor(private readonly ctx: StudioContext) {}

  private get localFile(): string {
    return join(this.ctx.config.root, 'config', 'local.json');
  }

  readLocal(): Record<string, unknown> {
    if (!existsSync(this.localFile)) return {};
    try {
      return JSON.parse(readFileSync(this.localFile, 'utf8')) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  /** Effective settings (config after overrides) plus the raw local overrides. */
  current(): { effective: Settings; local: Record<string, unknown>; engines: string[] } {
    const c = this.ctx.config;
    return {
      effective: {
        default_engine: c.default_engine,
        export_dir: c.export_dir,
        qc: { duration_tolerance: c.qc.duration_tolerance, cut_tolerance: c.qc.cut_tolerance, cer_max: c.qc.cer_max, identity_similarity_min: c.qc.identity_similarity_min, max_regen_attempts: c.qc.max_regen_attempts, black_min_sec: c.qc.black_min_sec, freeze_min_sec: c.qc.freeze_min_sec },
        assembly: { loudness_lufs: c.assembly.loudness_lufs, subtitle_font: c.assembly.subtitle_font, card_font: c.assembly.card_font, music_volume: c.assembly.music_volume },
        tools: c.tools,
        voice: { provider: c.voice.provider, max_speedup: c.voice.max_speedup, fit_tolerance_sec: c.voice.fit_tolerance_sec },
      },
      local: this.readLocal(),
      engines: Object.keys(c.engines),
    };
  }

  /** Deep-merge a partial settings patch into config/local.json and apply the safe parts live. */
  update(patch: Partial<Settings>): { local: Record<string, unknown>; restart_required: boolean } {
    const local = this.readLocal();
    const merged = deepMerge(local, patch as Record<string, unknown>);
    if (patch.default_engine && !this.ctx.config.engines[patch.default_engine]) throw new Error(`ไม่รู้จัก engine "${patch.default_engine}"`);
    this.ctx.store.writeJson(this.localFile, merged);
    // live-apply numeric thresholds and simple strings; tools/engine changes need a restart
    const c = this.ctx.config as unknown as Record<string, Record<string, unknown> | string>;
    for (const k of ['qc', 'assembly', 'voice'] as const) {
      const p = patch[k];
      if (p) Object.assign(c[k] as Record<string, unknown>, p);
    }
    if (patch.export_dir) (this.ctx.config as { export_dir: string }).export_dir = patch.export_dir;
    const restart_required = Boolean(patch.default_engine || patch.tools);
    this.ctx.log.info('settings_updated', { keys: Object.keys(patch), restart_required });
    return { local: merged, restart_required };
  }
}

function deepMerge(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) continue;
    const b = out[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && b && typeof b === 'object' && !Array.isArray(b)) out[k] = deepMerge(b as Record<string, unknown>, v as Record<string, unknown>);
    else out[k] = v;
  }
  return out;
}
