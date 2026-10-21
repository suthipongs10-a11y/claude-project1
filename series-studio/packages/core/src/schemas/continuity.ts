import { z } from 'zod';
import { EpisodeNumber, Slug } from './common.js';

/** Persistent state of one character at the end of an episode. */
export const CharacterState = z.strictObject({
  /** Wardrobe id (key of wardrobe_variants), 'default', or a description. */
  wardrobe: z.string().min(1).optional(),
  injury: z.string().optional(),
  holding: z.string().optional(),
  /** Emotional / knowledge state in prose. */
  state: z.string().optional(),
  /** Hair, makeup, accessories changes. */
  appearance: z.string().optional(),
});
export type CharacterState = z.infer<typeof CharacterState>;

export const ContinuityEntry = z.strictObject({
  after_episode: EpisodeNumber,
  states: z.record(Slug, CharacterState),
  notes: z.string().optional(),
});
export type ContinuityEntry = z.infer<typeof ContinuityEntry>;

/** continuity.json */
export const Continuity = z.strictObject({
  entries: z.array(ContinuityEntry).default([]),
});
export type Continuity = z.infer<typeof Continuity>;
