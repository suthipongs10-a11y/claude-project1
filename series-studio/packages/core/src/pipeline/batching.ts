import type { Shot } from '../schemas/index.js';

export interface BatchPlan {
  id: string;
  scene: number;
  shot_ids: string[];
  total_sec: number;
}

/**
 * Group consecutive shots of the same scene into clips no longer than `maxClipSec`
 * (SPEC §8.5). Deterministic: same shots + same limit => same batches. Ids are b01, b02, ...
 */
export function planBatches(shots: readonly Shot[], maxClipSec: number): BatchPlan[] {
  if (maxClipSec <= 0) throw new Error('maxClipSec ต้องมากกว่า 0');
  const batches: BatchPlan[] = [];
  let cur: BatchPlan | null = null;
  const flush = () => {
    if (cur) batches.push({ ...cur, total_sec: round1(cur.total_sec) });
    cur = null;
  };
  for (const s of shots) {
    if (s.duration_sec > maxClipSec + 1e-9) throw new Error(`ช็อต ${s.id} ยาว ${s.duration_sec} วิ เกิน maxClipSec ${maxClipSec} วิ`);
    const fits = cur !== null && cur.scene === s.scene && cur.total_sec + s.duration_sec <= maxClipSec + 1e-9;
    if (!fits) {
      flush();
      cur = { id: `b${String(batches.length + 1).padStart(2, '0')}`, scene: s.scene, shot_ids: [], total_sec: 0 };
    }
    (cur as BatchPlan).shot_ids.push(s.id);
    (cur as BatchPlan).total_sec += s.duration_sec;
  }
  flush();
  return batches;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
