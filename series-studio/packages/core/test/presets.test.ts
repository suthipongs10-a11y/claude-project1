import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findForbiddenTerms, parsePreset, summarizePreset } from '../src/index.js';

const stylesDir = join(__dirname, '..', '..', '..', 'presets', 'styles');

describe('style presets on disk', () => {
  const files = readdirSync(stylesDir).filter((f) => f.endsWith('.json')).sort();
  it('has at least one preset', () => {
    expect(files.length).toBeGreaterThan(0);
  });
  for (const f of files) {
    it(`${f} is valid, id matches file name, no forbidden terms`, () => {
      const p = parsePreset(JSON.parse(readFileSync(join(stylesDir, f), 'utf8')), f);
      expect(p.id).toBe(f.replace(/\.json$/, ''));
      expect(p.negative.length).toBeGreaterThan(0);
      const s = summarizePreset(p);
      expect(s.id).toBe(p.id);
    });
  }
});

describe('forbidden terms', () => {
  it('detects studio names case-insensitively on word boundaries', () => {
    expect(findForbiddenTerms('in the style of PIXAR movies').map((h) => h.term)).toEqual(['pixar']);
    expect(findForbiddenTerms('a pixarian texture')).toEqual([]); // not a whole word
    expect(findForbiddenTerms('Studio Ghibli vibes').map((h) => h.term)).toContain('ghibli');
    expect(findForbiddenTerms('warm Thai evening drama')).toEqual([]);
  });
  it('supports extra terms (e.g. real actor names added per series)', () => {
    expect(findForbiddenTerms('looks like Somchai Famous', ['somchai famous']).map((h) => h.term)).toEqual(['somchai famous']);
  });
  it('rejects a preset whose render tokens name a studio', () => {
    const base = JSON.parse(readFileSync(join(stylesDir, 'live_kdrama_dub.json'), 'utf8'));
    base.render_tokens = ['Pixar style 3D'];
    expect(() => parsePreset(base, 'test')).toThrow(/คำที่ห้ามใช้/);
  });
});
