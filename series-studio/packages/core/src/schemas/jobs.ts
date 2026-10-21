import { z } from 'zod';
import { EpisodeNumber, IsoDateTime, Quality, RelPath, Slug } from './common.js';

export const JobStatus = z.enum(['queued', 'running', 'awaiting_import', 'blocked', 'done', 'failed', 'cancelled']);
export type JobStatus = z.infer<typeof JobStatus>;

export const JobKind = z.enum(['ref', 'clip', 'character']);
export type JobKind = z.infer<typeof JobKind>;

export const EntityType = z.enum(['character', 'location', 'prop']);
export type EntityType = z.infer<typeof EntityType>;

/** A generation job: one clip for a batch of shots (`clip`) or reference images for an asset (`ref`). */
export const GenJob = z.strictObject({
  id: z.string().min(1),
  kind: JobKind,
  series_id: Slug,
  /** clip jobs */
  episode: EpisodeNumber.optional(),
  batch_id: Slug.optional(),
  shot_ids: z.array(Slug).default([]),
  /** ref jobs */
  entity_type: EntityType.optional(),
  entity_id: Slug.optional(),
  /** ref jobs: which view this job produces (e.g. "front", "expression: anger"). */
  view: z.string().min(1).optional(),
  quality: Quality,
  engine_id: z.string().min(1),
  status: JobStatus,
  attempt: z.int().min(1).default(1),
  prompt: z.string().min(1),
  ref_images: z.array(RelPath).default([]),
  /** Notes from QC / reviewer used to adjust the regen prompt. */
  fix_notes: z.string().optional(),
  /** Output clip relative to the project root once done. */
  output: RelPath.optional(),
  cost_credits: z.number().nonnegative().default(0),
  error: z.string().optional(),
  created_at: IsoDateTime,
  updated_at: IsoDateTime,
});
export type GenJob = z.infer<typeof GenJob>;

export const QcCheck = z.strictObject({
  name: z.string().min(1),
  pass: z.boolean(),
  value: z.union([z.number(), z.string(), z.boolean()]).optional(),
  threshold: z.union([z.number(), z.string()]).optional(),
  detail: z.string().optional(),
  /** True when the check could not run (missing tool/model); never counts as a failure. */
  skipped: z.boolean().default(false),
});
export type QcCheck = z.infer<typeof QcCheck>;

/** episodes/epNN/qc/<shot_id>.json */
export const QcResult = z.strictObject({
  shot_id: Slug,
  clip: RelPath,
  version: z.int().min(1),
  pass: z.boolean(),
  checks: z.array(QcCheck),
  reasons: z.array(z.string()).default([]),
  /** Optional human / Claude visual verdict. */
  review: z
    .strictObject({ pass: z.boolean(), reason: z.string(), by: z.enum(['claude', 'human']) })
    .optional(),
  at: IsoDateTime,
});
export type QcResult = z.infer<typeof QcResult>;

/** cost.json */
export const Cost = z.strictObject({
  episodes: z.record(z.string(), z.strictObject({ credits: z.number().nonnegative(), jobs: z.int().min(0) })).default({}),
  total_credits: z.number().nonnegative().default(0),
});
export type Cost = z.infer<typeof Cost>;
