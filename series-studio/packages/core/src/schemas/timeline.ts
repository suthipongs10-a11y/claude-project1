import { z } from 'zod';
import { EpisodeNumber, Quality, RelPath, Seconds, Slug } from './common.js';

export const TimelineSegment = z.strictObject({
  kind: z.enum(['card', 'clip']),
  /** Card kind or batch id. */
  id: z.string().min(1),
  /** Source clip (relative) for kind=clip. */
  clip: RelPath.optional(),
  version: z.int().min(1).optional(),
  /** Trim inside the source. */
  in_sec: Seconds.default(0),
  out_sec: Seconds,
  /** Position on the final timeline. */
  start_sec: Seconds,
  shot_ids: z.array(Slug).default([]),
  /** Warnings about this segment (e.g. source shorter than planned). */
  notes: z.array(z.string()).default([]),
});
export type TimelineSegment = z.infer<typeof TimelineSegment>;

export const SubtitleCue = z.strictObject({
  index: z.int().min(1),
  start_sec: Seconds,
  end_sec: Seconds,
  char: z.string().min(1),
  text: z.string().min(1),
  shot_id: Slug,
});
export type SubtitleCue = z.infer<typeof SubtitleCue>;

/** episodes/epNN/edit/timeline.json */
export const Timeline = z.strictObject({
  episode: EpisodeNumber,
  quality: Quality,
  aspect: z.enum(['9:16', '16:9']),
  width: z.int().min(16),
  height: z.int().min(16),
  fps: z.int().min(1),
  total_sec: Seconds,
  segments: z.array(TimelineSegment).min(1),
  subtitles: z.array(SubtitleCue).default([]),
  audio: z.strictObject({
    source: z.enum(['clips', 'voice_track', 'none']),
    voice_track: RelPath.optional(),
    music: RelPath.optional(),
    loudness_lufs: z.number(),
    measured: z.record(z.string(), z.number()).optional(),
  }),
  outputs: z.strictObject({
    video: RelPath,
    srt: RelPath.optional(),
    cover: RelPath.optional(),
  }),
  created_at: z.string(),
});
export type Timeline = z.infer<typeof Timeline>;
