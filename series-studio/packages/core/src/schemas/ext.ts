import { z } from 'zod';
import { Aspect, Quality, Slug } from './common.js';
import { JobKind } from './jobs.js';

/**
 * Protocol between studio-server and the Chrome extension (SPEC §10).
 * Server -> extension over WS: ExtJobMessage | ExtCancelMessage. Extension -> server: ExtClientMessage.
 * Clip/image bytes travel over HTTP (POST /api/ext/jobs/:id/result).
 */
export const ExtJobPayload = z.strictObject({
  id: z.string().min(1),
  kind: JobKind,
  series_id: Slug,
  episode: z.int().min(1).optional(),
  batch_id: Slug.optional(),
  entity_type: z.enum(['character', 'location', 'prop']).optional(),
  entity_id: Slug.optional(),
  view: z.string().optional(),
  prompt: z.string().min(1),
  aspect: Aspect,
  quality: Quality,
  /** Absolute URLs (with token) the extension can fetch for reference images. */
  ref_urls: z.array(z.string().url()).default([]),
  /** Flow character ids already created for characters in this job. */
  flow_character_ids: z.array(z.string().min(1)).default([]),
  /** Seconds the extension may wait for Flow to finish one generation. */
  timeout_sec: z.int().min(10),
  delays_ms: z.strictObject({ min: z.int().min(0), max: z.int().min(0) }),
  /** Where to fetch selectors (with token). */
  selectors_url: z.string().url(),
  /** Where to upload the result (with token). */
  result_url: z.string().url(),
});
export type ExtJobPayload = z.infer<typeof ExtJobPayload>;

export const ExtJobMessage = z.strictObject({ kind: z.literal('job'), job: ExtJobPayload });
export const ExtCancelMessage = z.strictObject({ kind: z.literal('cancel'), job_id: z.string().min(1) });
export type ExtServerMessage = z.infer<typeof ExtJobMessage> | z.infer<typeof ExtCancelMessage>;

export const ExtStatus = z.enum(['running', 'blocked', 'failed', 'done']);

export const ExtClientMessage = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('ext_hello'), version: z.string().min(1), busy: z.boolean().default(false) }),
  z.strictObject({
    kind: z.literal('job_status'),
    job_id: z.string().min(1),
    status: ExtStatus,
    step: z.string().optional(),
    message: z.string().optional(),
    url: z.string().optional(),
    /** Selector key that could not be found (blocked). */
    selector: z.string().optional(),
  }),
  z.strictObject({ kind: z.literal('character_created'), job_id: z.string().min(1), entity_id: Slug, flow_character_id: z.string().min(1) }),
  z.strictObject({ kind: z.literal('ping') }),
]);
export type ExtClientMessage = z.infer<typeof ExtClientMessage>;

/** config/flow-selectors.json — CSS selectors for Google Flow, editable without rebuilding. */
export const FlowSelectors = z.strictObject({
  version: z.int().min(1),
  /** URL patterns (prefix match) that count as a Flow page. */
  flow_url_prefixes: z.array(z.string().url()).min(1),
  /** Open this URL when no Flow tab exists. */
  flow_home_url: z.string().url(),
  selectors: z.record(z.string(), z.string().min(1)),
  /** Max seconds to wait for a selector to appear. */
  wait_sec: z.int().min(1).default(30),
  notes: z.string().optional(),
});
export type FlowSelectors = z.infer<typeof FlowSelectors>;
