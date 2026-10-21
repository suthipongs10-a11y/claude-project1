import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { StudioContext } from '../context.js';
import type { TaskRecord } from '../services/tasks.js';
import { fail, ok } from './_helpers.js';

/**
 * Run `fn` as a background task, wait up to `waitSec` for it, and either return the finished
 * result (rendered by `render`) or a task id to poll with task_status.
 */
export async function runAsTask<T>(
  ctx: StudioContext,
  meta: { kind: string; label: string; series_id?: string | undefined; episode?: number | undefined },
  waitSec: number,
  fn: (progress: (msg: string) => void) => Promise<T>,
  render: (result: T) => CallToolResult,
): Promise<CallToolResult> {
  const task = ctx.tasks.start(meta, fn);
  const done = await ctx.tasks.waitFor(task.id, waitSec * 1000);
  return renderTask(done ?? task, render as (r: unknown) => CallToolResult);
}

export function renderTask(t: TaskRecord, render?: (result: unknown) => CallToolResult): CallToolResult {
  if (t.status === 'done') {
    const res = render ? render(t.result) : ok({ result: t.result ?? null });
    return { ...res, structuredContent: { ...(res.structuredContent ?? {}), task_id: t.id, task_status: 'done' } };
  }
  if (t.status === 'failed') return fail(`${t.label} ล้มเหลว: ${t.error ?? 'ไม่ทราบสาเหตุ'}`, { task_id: t.id, task_status: 'failed' });
  const elapsed = Math.round((Date.now() - new Date(t.started_at).getTime()) / 1000);
  return ok(
    { task_id: t.id, task_status: 'running', kind: t.kind, label: t.label, progress: t.progress ?? null, elapsed_sec: elapsed },
    `${t.label} กำลังทำอยู่ (${elapsed}s${t.progress ? `, ${t.progress}` : ''}) — งานนี้ใช้เวลานาน เรียก task_status task_id="${t.id}" เป็นระยะเพื่อรับผลลัพธ์ (ไม่ต้องสั่งซ้ำ)`,
  );
}
