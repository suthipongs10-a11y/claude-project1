import { describe, expect, it } from 'vitest';
import { JobStore } from '../src/store/db.js';

const now = '2026-10-21T00:00:00.000Z';
const base = { kind: 'ref', series_id: 'demo', entity_type: 'character', entity_id: 'mina', quality: 'final', engine_id: 'manual', status: 'awaiting_import', attempt: 1, prompt: 'p', shot_ids: [], ref_images: [], cost_credits: 0, created_at: now, updated_at: now } as const;

describe('JobStore (sqlite)', () => {
  it('creates, updates, lists and counts jobs', () => {
    let i = 0;
    const jobs = new JobStore(':memory:', () => `job_${++i}`);
    const a = jobs.create({ ...base, view: 'front' });
    const b = jobs.create({ ...base, view: 'side' });
    jobs.create({ ...base, kind: 'clip', entity_type: undefined, entity_id: undefined, episode: 1, batch_id: 'b01', shot_ids: ['ep01_s001'], status: 'queued', quality: 'draft' });
    expect(a.id).toBe('job_1');
    expect(jobs.list({ series_id: 'demo', kind: 'ref', entity_id: 'mina' }).map((j) => j.id)).toEqual(['job_1', 'job_2']);
    expect(jobs.list({ series_id: 'demo', episode: 1 }).length).toBe(1);
    const done = jobs.update(b.id, { status: 'done', output: 'bible/characters/mina/refs/v1/side.png', updated_at: now });
    expect(done.status).toBe('done');
    expect(jobs.get(b.id)?.output).toBe('bible/characters/mina/refs/v1/side.png');
    expect(jobs.counts('demo')).toEqual({ awaiting_import: 1, done: 1, queued: 1 });
    expect(() => jobs.update('nope', { updated_at: now })).toThrow(/ไม่พบงาน/);
    jobs.close();
  });
});
