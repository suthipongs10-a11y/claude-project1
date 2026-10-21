import type { GenJob, JobHandle, JobStatusInfo, VideoEngine, EngineConfig } from '@series-studio/core';

/**
 * Manual engine (SPEC §5.2): prompts are exported as a sheet, the user generates clips in
 * Flow by hand and imports the files back. Jobs sit in `awaiting_import` until import_clips.
 */
export class ManualEngine implements VideoEngine {
  readonly id = 'manual';
  readonly maxClipSec: number;
  readonly supportsRefImages: boolean;
  readonly supportsNativeDialogue: boolean;

  constructor(cfg: EngineConfig) {
    this.maxClipSec = cfg.maxClipSec;
    this.supportsRefImages = cfg.supportsRefImages;
    this.supportsNativeDialogue = cfg.supportsNativeDialogue;
  }

  async submit(job: GenJob): Promise<JobHandle> {
    return { jobId: job.id };
  }

  async poll(): Promise<JobStatusInfo> {
    return { status: 'awaiting_import', message: 'รอผู้ใช้เจนใน Flow แล้ว import_clips' };
  }

  async fetch(): Promise<string> {
    throw new Error('manual engine ไม่ดาวน์โหลดไฟล์เอง ใช้ import_clips');
  }
}
