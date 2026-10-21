import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { GenJob, parseOrThrow } from '@series-studio/core';

interface JobRow {
  id: string;
  data: string;
  series_id: string;
  episode: number | null;
  status: string;
  kind: string;
  created_at: string;
  updated_at: string;
}

export interface JobFilter {
  series_id?: string;
  episode?: number;
  status?: GenJob['status'] | GenJob['status'][];
  kind?: GenJob['kind'];
  entity_id?: string;
  batch_id?: string;
}

/**
 * SQLite-backed job queue (SPEC §5.1). Only job/state live here; media files stay under
 * projects/. The JSON document is the source of truth; indexed columns are for querying.
 */
export class JobStore {
  private readonly db: Database.Database;

  constructor(file: string, private readonly newId: () => string = defaultId) {
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
    this.db = new Database(file);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        series_id TEXT NOT NULL,
        episode INTEGER,
        status TEXT NOT NULL,
        kind TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS jobs_series ON jobs(series_id, episode);
      CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status);
    `);
  }

  close(): void {
    this.db.close();
  }

  create(input: Omit<GenJob, 'id'>): GenJob {
    const job = parseOrThrow(GenJob, { ...input, id: this.newId() }, 'job');
    this.db
      .prepare(
        'INSERT INTO jobs (id, data, series_id, episode, status, kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(job.id, JSON.stringify(job), job.series_id, job.episode ?? null, job.status, job.kind, job.created_at, job.updated_at);
    return job;
  }

  get(id: string): GenJob | undefined {
    const row = this.db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as JobRow | undefined;
    return row ? (JSON.parse(row.data) as GenJob) : undefined;
  }

  update(id: string, patch: Partial<Omit<GenJob, 'id'>> & { updated_at: string }): GenJob {
    const cur = this.get(id);
    if (!cur) throw new Error(`ไม่พบงาน ${id}`);
    const next = parseOrThrow(GenJob, { ...cur, ...patch }, 'job');
    this.db
      .prepare('UPDATE jobs SET data = ?, status = ?, episode = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(next), next.status, next.episode ?? null, next.updated_at, id);
    return next;
  }

  list(filter: JobFilter = {}): GenJob[] {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.series_id) {
      where.push('series_id = ?');
      params.push(filter.series_id);
    }
    if (filter.episode !== undefined) {
      where.push('episode = ?');
      params.push(filter.episode);
    }
    if (filter.kind) {
      where.push('kind = ?');
      params.push(filter.kind);
    }
    if (filter.status) {
      const list = Array.isArray(filter.status) ? filter.status : [filter.status];
      where.push(`status IN (${list.map(() => '?').join(',')})`);
      params.push(...list);
    }
    const sql = `SELECT * FROM jobs ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at ASC, id ASC`;
    const rows = this.db.prepare(sql).all(...params) as JobRow[];
    let jobs = rows.map((r) => JSON.parse(r.data) as GenJob);
    if (filter.entity_id) jobs = jobs.filter((j) => j.entity_id === filter.entity_id);
    if (filter.batch_id) jobs = jobs.filter((j) => j.batch_id === filter.batch_id);
    return jobs;
  }

  counts(series_id: string, episode?: number): Record<string, number> {
    const out: Record<string, number> = {};
    for (const j of this.list(episode === undefined ? { series_id } : { series_id, episode })) {
      out[j.status] = (out[j.status] ?? 0) + 1;
    }
    return out;
  }
}

function defaultId(): string {
  return `job_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
}
