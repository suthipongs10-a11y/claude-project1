import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { makeTempStudio } from './helpers.js';

describe('FileStore', () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => cleanups.splice(0).forEach((c) => c()));

  it('creates the §6 skeleton and round-trips JSON', () => {
    const t = makeTempStudio();
    cleanups.push(t.cleanup);
    const s = t.ctx.store;
    s.ensureSeriesSkeleton('demo', 2);
    for (const d of ['bible/characters', 'bible/locations', 'bible/props', 'episodes/ep01/gen', 'episodes/ep02/final']) {
      expect(existsSync(join(s.seriesDir('demo'), d))).toBe(true);
    }
    const file = join(s.seriesDir('demo'), 'series.json');
    s.writeJson(file, { a: 1 });
    expect(s.readJson(file, z.object({ a: z.number() }), 'test')).toEqual({ a: 1 });
    expect(s.listSeriesIds()).toEqual(['demo']);
    expect(s.listFiles(s.seriesDir('demo'), '.json')).toEqual(['series.json']);
  });

  it('moves files to _trash instead of deleting', () => {
    const t = makeTempStudio();
    cleanups.push(t.cleanup);
    const s = t.ctx.store;
    s.ensureSeriesSkeleton('demo', 1);
    const f = s.episodePath('demo', 1, 'shots.json');
    s.writeJson(f, { x: 1 });
    const dest = s.moveToTrash('demo', f);
    expect(existsSync(f)).toBe(false);
    expect(dest).toContain(join('demo', '_trash'));
    expect(dest.endsWith(join('episodes', 'ep01', 'shots.json'))).toBe(true);
    expect(JSON.parse(readFileSync(dest, 'utf8'))).toEqual({ x: 1 });
    expect(s.listSeriesIds()).toEqual([]); // no series.json yet -> not a series
  });

  it('refuses to write refs of a locked asset and versions folders', () => {
    const t = makeTempStudio();
    cleanups.push(t.cleanup);
    const s = t.ctx.store;
    s.ensureSeriesSkeleton('demo', 1);
    const src = join(t.root, 'front.png');
    writeFileSync(src, 'png');
    const rel = s.storeRef('demo', 'characters', 'mina', src, { locked: false, version: 1 });
    expect(rel).toBe('bible/characters/mina/refs/v1/front.png');
    expect(() => s.storeRef('demo', 'characters', 'mina', src, { locked: true, version: 1 })).toThrow(/lock/);
    const rel2 = s.storeRef('demo', 'characters', 'mina', src, { locked: false, version: 2 });
    expect(rel2).toBe('bible/characters/mina/refs/v2/front.png');
  });

  it('blocks paths that escape the series folder', () => {
    const t = makeTempStudio();
    cleanups.push(t.cleanup);
    expect(() => t.ctx.store.abs('demo', '../other')).toThrow(/นอกโฟลเดอร์/);
    expect(() => t.ctx.store.seriesDir('../x')).toThrow();
  });
});
