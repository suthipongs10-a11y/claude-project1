import { z } from 'zod';
import { EpisodeNumber, PositiveSeconds, RelPath, Seconds, Slug } from './common.js';

// ---------------------------------------------------------------- outline
export const BeatType = z.enum(['hook', 'setup', 'conflict', 'mystery', 'twist', 'bridge', 'cliffhanger']);
export type BeatType = z.infer<typeof BeatType>;

export const Beat = z.strictObject({
  id: Slug,
  type: BeatType,
  summary: z.string().min(1),
  /** Target duration of this beat. */
  est_sec: PositiveSeconds.optional(),
});
export type Beat = z.infer<typeof Beat>;

/** episodes/epNN/outline.json */
export const Outline = z.strictObject({
  episode: EpisodeNumber,
  title: z.string().min(1),
  synopsis: z.string().min(1),
  beats: z.array(Beat).min(2),
  /** Short description of the closing cliffhanger image/line. */
  cliffhanger: z.string().min(1),
});
export type Outline = z.infer<typeof Outline>;

// ---------------------------------------------------------------- script
export const ScriptLine = z.strictObject({
  id: Slug,
  scene: z.int().min(1),
  /** Character id, or NARRATOR. */
  char: z.string().min(1),
  /** Spoken Thai (colloquial), as it should be heard. */
  text: z.string().min(1),
  emotion: z.string().optional(),
  /** Stage direction for this line. */
  action: z.string().optional(),
});
export type ScriptLine = z.infer<typeof ScriptLine>;

export const SceneHeader = z.strictObject({
  scene: z.int().min(1),
  location: Slug,
  time: z.string().min(1),
  summary: z.string().min(1),
});

/** episodes/epNN/script.json */
export const Script = z.strictObject({
  episode: EpisodeNumber,
  scenes: z.array(SceneHeader).min(1),
  lines: z.array(ScriptLine),
});
export type Script = z.infer<typeof Script>;

// ---------------------------------------------------------------- shots
export const ShotType = z.enum(['ECU', 'CU', 'MCU', 'MS', 'WS', 'EWS', 'OTS', 'POV', 'INSERT']);
export type ShotType = z.infer<typeof ShotType>;

export const ScreenPos = z.enum(['left', 'center', 'right']);
export const AxisSide = z.enum(['A', 'B']);

export const ShotCharacter = z.strictObject({
  id: Slug,
  screen_pos: ScreenPos,
  emotion: z.string().min(1),
  /** 'default' or a key of character.wardrobe_variants, or a free description. */
  wardrobe: z.string().min(1).default('default'),
});
export type ShotCharacter = z.infer<typeof ShotCharacter>;

export const DialogueCue = z.strictObject({
  char: z.string().min(1),
  text: z.string().min(1),
  t_start: Seconds,
  t_end: PositiveSeconds,
});
export type DialogueCue = z.infer<typeof DialogueCue>;

/** One shot of the shot list (SPEC §7). */
export const Shot = z.strictObject({
  id: Slug,
  scene: z.int().min(1),
  /** Assigned by the batching step; null until then. */
  batch: Slug.nullable().default(null),
  duration_sec: PositiveSeconds,
  type: ShotType,
  angle: z.string().min(1),
  lens: z.string().min(1),
  movement: z.string().min(1),
  /** 180° axis side. */
  axis_side: AxisSide,
  /** Required when the axis flips without a neutral/INSERT shot in between. */
  axis_cross_reason: z.string().min(1).optional(),
  characters: z.array(ShotCharacter).default([]),
  location: Slug,
  time: z.string().min(1),
  light_motivation: z.string().min(1),
  action: z.string().min(1),
  dialogue: z.array(DialogueCue).default([]),
  sfx: z.array(z.string().min(1)).default([]),
  /** Every shot needs a reason to exist. */
  purpose: z.string().min(1),
  beat: BeatType,
  /** Style preset id for dream/flashback shots only. */
  style_override: Slug.nullable().default(null),
  /** Max number of people allowed in frame (QC). Defaults to characters.length. */
  max_people: z.int().min(0).optional(),
});
export type Shot = z.infer<typeof Shot>;
export type ShotInput = z.input<typeof Shot>;

/** episodes/epNN/shots.json */
export const ShotList = z.strictObject({
  episode: EpisodeNumber,
  shots: z.array(Shot).min(1),
});
export type ShotList = z.infer<typeof ShotList>;
export type ShotListInput = z.input<typeof ShotList>;

// ---------------------------------------------------------------- batches
/** episodes/epNN/batches/<id>.json - shots generated together as one clip. */
export const Batch = z.strictObject({
  id: Slug,
  episode: EpisodeNumber,
  scene: z.int().min(1),
  shot_ids: z.array(Slug).min(1),
  total_sec: PositiveSeconds,
  engine_id: z.string().min(1),
  /** Compiled prompt text (deterministic). */
  prompt: z.string().min(1),
  /** Reference images attached to this batch, relative to the project root. */
  ref_images: z.array(RelPath).default([]),
});
export type Batch = z.infer<typeof Batch>;

export const EpisodeStatus = z.enum([
  'planned',
  'scripted',
  'shots_ready',
  'prompts_ready',
  'generating',
  'qc',
  'draft_approved',
  'assembling',
  'final_ready',
  'exported',
]);
export type EpisodeStatus = z.infer<typeof EpisodeStatus>;

/** episodes/epNN/state.json */
export const EpisodeState = z.strictObject({
  episode: EpisodeNumber,
  status: EpisodeStatus.default('planned'),
  gates: z
    .strictObject({
      G3: z.strictObject({ approved: z.boolean(), at: z.string().optional(), note: z.string().optional() }).default({ approved: false }),
      G4: z.strictObject({ approved: z.boolean(), at: z.string().optional(), note: z.string().optional() }).default({ approved: false }),
    })
    .default({ G3: { approved: false }, G4: { approved: false } }),
  updated_at: z.string().optional(),
});
export type EpisodeState = z.infer<typeof EpisodeState>;
