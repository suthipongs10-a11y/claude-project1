import { randomBytes } from 'node:crypto';
import type { StudioContext } from '../context.js';

export type TaskStatus = 'running' | 'done' | 'failed';

export interface TaskRecord<T = unknown> {
  id: string;
  kind: string;
  label: string;
  series_id?: string | undefined;
  episode?: number | undefined;
  status: TaskStatus;
  progress?: string | undefined;
  started_at: string;
  finished_at?: string | undefined;
  result?: T | undefined;
  error?: string | undefined;
}

/**
 * Long-running work (assembly, QC, dubbing) runs here so an MCP tool call never has to block
 * longer than the client's request timeout (Claude Desktop cuts off around 60 s). Tools wait a
 * short budget for a quick result and otherwise hand back a task id for task_status.
 */
export class TaskService {
  private readonly tasks = new Map<string, TaskRecord>();
  private readonly waiters = new Map<string, Array<() => void>>();

  constructor(private readonly ctx: StudioContext) {}

  start<T>(meta: { kind: string; label: string; series_id?: string | undefined; episode?: number | undefined }, fn: (progress: (msg: string) => void) => Promise<T>): TaskRecord<T> {
    const id = `task_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
    const rec: TaskRecord<T> = { id, kind: meta.kind, label: meta.label, series_id: meta.series_id, episode: meta.episode, status: 'running', started_at: this.ctx.now() };
    this.tasks.set(id, rec);
    this.ctx.log.info('task_started', { task_id: id, kind: meta.kind, label: meta.label });
    this.ctx.emit({ type: 'task', task_id: id, status: 'running', kind: meta.kind, ...(meta.series_id ? { series_id: meta.series_id } : {}), ...(meta.episode !== undefined ? { episode: meta.episode } : {}) });
    const progress = (msg: string) => {
      rec.progress = msg;
    };
    fn(progress)
      .then((result) => {
        rec.status = 'done';
        rec.result = result;
      })
      .catch((e: unknown) => {
        rec.status = 'failed';
        rec.error = e instanceof Error ? e.message : String(e);
      })
      .finally(() => {
        rec.finished_at = this.ctx.now();
        this.ctx.log.info('task_finished', { task_id: id, kind: meta.kind, status: rec.status, error: rec.error });
        this.ctx.emit({ type: 'task', task_id: id, status: rec.status, kind: meta.kind, ...(meta.series_id ? { series_id: meta.series_id } : {}), ...(meta.episode !== undefined ? { episode: meta.episode } : {}) });
        for (const w of this.waiters.get(id) ?? []) w();
        this.waiters.delete(id);
        // keep finished tasks for a while so late task_status calls still find them
        setTimeout(() => this.tasks.delete(id), 6 * 60 * 60 * 1000).unref?.();
      });
    return rec;
  }

  get(id: string): TaskRecord | undefined {
    return this.tasks.get(id);
  }

  list(filter: { series_id?: string | undefined; episode?: number | undefined; status?: TaskStatus | undefined } = {}): TaskRecord[] {
    return [...this.tasks.values()]
      .filter((t) => (!filter.series_id || t.series_id === filter.series_id) && (filter.episode === undefined || t.episode === filter.episode) && (!filter.status || t.status === filter.status))
      .sort((a, b) => a.started_at.localeCompare(b.started_at));
  }

  /** Resolve when the task finishes or after `ms`, whichever comes first. */
  waitFor(id: string, ms: number): Promise<TaskRecord | undefined> {
    const rec = this.tasks.get(id);
    if (!rec || rec.status !== 'running' || ms <= 0) return Promise.resolve(rec);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const list = this.waiters.get(id) ?? [];
        this.waiters.set(id, list.filter((w) => w !== done));
        resolve(this.tasks.get(id));
      }, ms);
      const done = () => {
        clearTimeout(timer);
        resolve(this.tasks.get(id));
      };
      this.waiters.set(id, [...(this.waiters.get(id) ?? []), done]);
    });
  }
}
