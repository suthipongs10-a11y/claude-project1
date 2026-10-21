import { z } from 'zod';

/** Lower-case slug used for series ids, entity ids and file names. */
export const Slug = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, 'slug ต้องเป็น a-z, 0-9, _ หรือ - และเริ่มด้วยตัวอักษรหรือตัวเลข');
export type Slug = z.infer<typeof Slug>;

export const Aspect = z.enum(['9:16', '16:9']);
export type Aspect = z.infer<typeof Aspect>;

export const IsoDateTime = z.iso.datetime({ offset: true });

/** Relative path inside a project folder (no absolute paths, no parent traversal). */
export const RelPath = z
  .string()
  .min(1)
  .refine((p) => !p.startsWith('/') && !p.split(/[\\/]/).includes('..'), {
    message: 'path ต้องเป็น relative path ภายในโปรเจกต์ ห้ามใช้ .. หรือ path สัมบูรณ์',
  });
export type RelPath = z.infer<typeof RelPath>;

export const Seconds = z.number().nonnegative();
export const PositiveSeconds = z.number().positive();

export const EpisodeNumber = z.int().min(1).max(999);
export type EpisodeNumber = z.infer<typeof EpisodeNumber>;

export const Quality = z.enum(['draft', 'final']);
export type Quality = z.infer<typeof Quality>;

/** Build the canonical episode folder name (ep01, ep02, ...). */
export function episodeDir(n: number): string {
  return `ep${String(n).padStart(2, '0')}`;
}
