import { z } from 'zod';
import { RelPath, Slug } from './common.js';

/** How a character refers to themselves and others (Thai pronoun/particle system). */
export const Speech = z.strictObject({
  self: z.string().min(1).optional(),
  to_elder: z.string().min(1).optional(),
  to_lover: z.string().min(1).optional(),
  to_friend: z.string().min(1).optional(),
  particles: z.string().min(1).optional(),
  /** Free-form notes: dialect, catchphrases, speech tempo. */
  notes: z.string().optional(),
});
export type Speech = z.infer<typeof Speech>;

const Lockable = {
  refs: z.array(RelPath).default([]),
  /** Reference version. Incremented whenever refs are replaced after an unlock. */
  ref_version: z.int().min(1).default(1),
  locked: z.boolean().default(false),
};

/** bible/characters/<char_id>.json */
export const Character = z.strictObject({
  id: Slug,
  name: z.string().min(1),
  role: z.string().min(1),
  age: z.int().min(0).max(150).optional(),
  /** Visual description used verbatim in every prompt (keep stable!). */
  look: z.string().min(1),
  wardrobe_default: z.string().min(1),
  /** Named alternative outfits: key = wardrobe id used in shots, value = description. */
  wardrobe_variants: z.record(Slug, z.string().min(1)).default({}),
  personality: z.string().min(1),
  speech: Speech.default({}),
  voice_id: z.string().min(1).optional(),
  flow_character_id: z.string().nullable().default(null),
  ...Lockable,
});
export type Character = z.infer<typeof Character>;
export type CharacterInput = z.input<typeof Character>;

/** bible/locations/<loc_id>.json */
export const Location = z.strictObject({
  id: Slug,
  name: z.string().min(1),
  /** Visual description used verbatim in prompts. */
  look: z.string().min(1).optional(),
  time_variants: z.array(z.string().min(1)).min(1),
  light_sources: z.array(z.string().min(1)).default([]),
  axis_notes: z.string().optional(),
  ...Lockable,
});
export type Location = z.infer<typeof Location>;
export type LocationInput = z.input<typeof Location>;

/** bible/props/<prop_id>.json */
export const Prop = z.strictObject({
  id: Slug,
  name: z.string().min(1),
  look: z.string().min(1),
  /** True for the product in product mode (gets packshot treatment and an ad label). */
  is_product: z.boolean().default(false),
  ...Lockable,
});
export type Prop = z.infer<typeof Prop>;
export type PropInput = z.input<typeof Prop>;

export const VoiceAssignment = z.strictObject({
  voice_id: z.string().min(1),
  provider: z.string().min(1).optional(),
  lang: z.string().min(2).max(8).default('th'),
  notes: z.string().optional(),
});

/** bible/voices.json: character id -> voice. "NARRATOR" is a reserved key. */
export const Voices = z.record(z.string().min(1), VoiceAssignment);
export type Voices = z.infer<typeof Voices>;

export const Bible = z.strictObject({
  story_md: z.string().min(1),
  characters: z.array(Character),
  locations: z.array(Location),
  props: z.array(Prop).default([]),
  voices: Voices.default({}),
});
export type Bible = z.infer<typeof Bible>;
export type BibleInput = z.input<typeof Bible>;

export const NARRATOR_ID = 'NARRATOR';
