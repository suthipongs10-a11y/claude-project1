import { z } from 'zod';
import { Aspect, EpisodeNumber, IsoDateTime, RelPath, Slug } from './common.js';

export const GateId = z.enum(['G1', 'G2', 'G3', 'G4']);
export type GateId = z.infer<typeof GateId>;

export const GateApproval = z.strictObject({
  approved: z.boolean(),
  at: IsoDateTime.optional(),
  /** Where the approval came from. */
  via: z.enum(['chat', 'dashboard']).optional(),
  note: z.string().optional(),
});
export type GateApproval = z.infer<typeof GateApproval>;

/** Product placement settings (SPEC §12). The product itself is a locked prop. */
export const Product = z.strictObject({
  name: z.string().min(1),
  /** Prop id in bible/props that holds the packshot refs. */
  prop_id: Slug,
  selling_points: z.array(z.string().min(1)).min(1).max(3),
  cta: z.string().min(1),
  link: z.string().url().optional(),
  /** Episodes that must contain a `bridge` beat and a product card. */
  bridge_episodes: z.array(EpisodeNumber).min(1),
});
export type Product = z.infer<typeof Product>;

export const SeriesStatus = z.enum(['planning', 'bible_approved', 'assets_locked', 'production', 'complete']);
export type SeriesStatus = z.infer<typeof SeriesStatus>;

/** series.json (SPEC §6). */
export const Series = z.strictObject({
  id: Slug,
  title: z.string().min(1),
  logline: z.string().min(1),
  style_id: Slug,
  aspect: Aspect,
  episodes: EpisodeNumber,
  ep_length_sec: z.number().positive(),
  product: Product.nullable().default(null),
  engine_id: z.string().min(1).default('manual'),
  status: SeriesStatus.default('planning'),
  gates: z
    .strictObject({
      G1: GateApproval.default({ approved: false }),
      G2: GateApproval.default({ approved: false }),
    })
    .default({ G1: { approved: false }, G2: { approved: false } }),
  created_at: IsoDateTime,
  updated_at: IsoDateTime,
  /** Cover image relative path, if any. */
  cover: RelPath.optional(),
});
export type Series = z.infer<typeof Series>;
export type SeriesInput = z.input<typeof Series>;
