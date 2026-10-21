import { z } from 'zod';
import { Aspect, Slug } from './common.js';

export const Medium = z.enum(['live_action', '2d', '3d', 'mixed']);
export type Medium = z.infer<typeof Medium>;

export const DialogueMode = z.enum(['native', 'dub', 'narration', 'sfx_only']);
export type DialogueMode = z.infer<typeof DialogueMode>;

export const StyleCamera = z.strictObject({
  lens_default: z.string().min(1),
  lens_closeup: z.string().min(1),
  aspect_modes: z.array(Aspect).min(1),
  movement_vocab: z.array(z.string().min(1)).min(1),
});

export const StylePacing = z.strictObject({
  avg_shot_sec: z.number().positive(),
  cuts_per_30s: z.number().positive(),
});

/** Per-preset QC thresholds. All optional; the server config supplies defaults. */
export const StyleQcThresholds = z.strictObject({
  /** Minimum similarity (0-1) of character identity vs reference (insightface for live, CLIP for drawn). */
  identity_similarity_min: z.number().min(0).max(1).optional(),
  /** Maximum character error rate (0-1) for native dialogue transcription. */
  cer_max: z.number().min(0).max(1).optional(),
});

/**
 * Style preset (SPEC §4.2). Lives as JSON in presets/styles/<id>.json and can be
 * added without code changes.
 */
export const StylePreset = z.strictObject({
  id: Slug,
  label: z.string().min(1),
  medium: Medium,
  render_tokens: z.array(z.string().min(1)).min(1),
  camera: StyleCamera,
  lighting: z.string().min(1),
  grade: z.string().min(1),
  acting: z.string().min(1),
  pacing: StylePacing,
  dialogue_mode: DialogueMode,
  /** Language the model should speak (ISO 639-1). For dub, dialogue is replaced later. */
  dialogue_lang_in_model: z.string().min(2).max(8),
  subtitle_style: z.string().min(1),
  negative: z.array(z.string().min(1)),
  character_sheet: z.string().min(1),
  location_sheet: z.string().min(1),
  cliffhanger_style: z.string().min(1),
  /** Optional free-text notes for humans (not used in prompts). */
  notes: z.string().optional(),
  qc: StyleQcThresholds.optional(),
});
export type StylePreset = z.infer<typeof StylePreset>;
