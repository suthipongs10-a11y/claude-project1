import type { VideoEngine } from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { engineConfig } from '../config.js';
import { ManualEngine } from './manual.js';
import { FlowExtEngine } from './flow_ext.js';

/** Engine registry: adding an engine means adding a case here plus a config block (SPEC §5.2). */
export function getEngine(ctx: StudioContext, engineId: string): VideoEngine {
  const cfg = engineConfig(ctx.config, engineId);
  switch (engineId) {
    case 'manual':
      return new ManualEngine(cfg);
    case 'flow_ext':
      return new FlowExtEngine(ctx, cfg);
    default:
      throw new Error(`engine "${engineId}" มีใน config แต่ยังไม่มี adapter (รองรับ: manual, flow_ext)`);
  }
}
