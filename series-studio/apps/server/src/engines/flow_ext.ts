import type { EngineConfig, GenJob, JobHandle, JobStatusInfo, VideoEngine } from '@series-studio/core';
import type { StudioContext } from '../context.js';

/**
 * flow_ext engine (SPEC §5.2 / §10): jobs are queued for the paired Chrome extension, which
 * drives Google Flow in the user's own logged-in browser session. Results come back through
 * the ExtensionBridge (WS status + HTTP upload).
 */
export class FlowExtEngine implements VideoEngine {
  readonly id = 'flow_ext';
  readonly maxClipSec: number;
  readonly supportsRefImages: boolean;
  readonly supportsNativeDialogue: boolean;

  constructor(
    private readonly ctx: StudioContext,
    cfg: EngineConfig,
  ) {
    this.maxClipSec = cfg.maxClipSec;
    this.supportsRefImages = cfg.supportsRefImages;
    this.supportsNativeDialogue = cfg.supportsNativeDialogue;
  }

  async submit(job: GenJob): Promise<JobHandle> {
    // the job row is already 'queued'; the bridge dispatches when the extension is free
    this.ctx.ext?.pump();
    return { jobId: job.id };
  }

  async poll(handle: JobHandle): Promise<JobStatusInfo> {
    const job = this.ctx.jobs.get(handle.jobId);
    if (!job) return { status: 'failed', message: 'ไม่พบงาน' };
    const connected = this.ctx.ext?.status().connected ?? false;
    const message = job.status === 'queued' && !connected ? 'รอ Chrome Extension เชื่อมต่อ (เปิด Chrome ที่ติดตั้ง extension และจับคู่ token)' : job.error;
    return {
      status: job.status,
      ...(job.output ? { output: job.output } : {}),
      ...(message ? { message } : {}),
    };
  }

  async fetch(handle: JobHandle): Promise<string> {
    const job = this.ctx.jobs.get(handle.jobId);
    if (!job?.output) throw new Error('งานยังไม่มีไฟล์ผลลัพธ์');
    return job.output;
  }
}
