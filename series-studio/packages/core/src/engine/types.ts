import type { GenJob, Quality } from '../schemas/index.js';

/** Per-engine settings. Loaded from config; never hardcode these (CLAUDE.md rule 4). */
export interface EngineConfig {
  /** Longest clip the engine can produce in one generation. */
  maxClipSec: number;
  supportsRefImages: boolean;
  supportsNativeDialogue: boolean;
  /** Credits charged per clip at each quality (for cost.json). */
  creditsPerClip: Record<Quality, number>;
  /** Minimum delay between submissions (ms); flow_ext adds random jitter on top. */
  minDelayMs?: number | undefined;
  maxDelayMs?: number | undefined;
  /** Seconds before a dispatched extension job is considered lost. */
  jobTimeoutSec?: number | undefined;
  /** Selector config file (relative to the studio root) for the flow_ext driver. */
  selectorsFile?: string | undefined;
}

export interface JobHandle {
  jobId: string;
  engineRef?: string;
}

export interface JobStatusInfo {
  status: GenJob['status'];
  progress?: number;
  message?: string;
  /** Path of the finished clip when status === 'done'. */
  output?: string;
  costCredits?: number;
}

/** Engine adapter (SPEC §5.2). `manual` exports prompt sheets; `flow_ext` drives Google Flow. */
export interface VideoEngine {
  readonly id: string;
  readonly maxClipSec: number;
  readonly supportsRefImages: boolean;
  readonly supportsNativeDialogue: boolean;
  submit(job: GenJob): Promise<JobHandle>;
  poll(handle: JobHandle): Promise<JobStatusInfo>;
  fetch(handle: JobHandle, dest: string): Promise<string>;
}
