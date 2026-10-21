import { describe, expect, it } from 'vitest';
import { Character, RelPath, Series, Shot, Slug, episodeDir, parseOrThrow, SchemaError } from '../src/index.js';

const now = '2026-10-21T00:00:00.000Z';

describe('common schemas', () => {
  it('accepts valid slugs and rejects bad ones', () => {
    expect(Slug.parse('mina_01')).toBe('mina_01');
    expect(Slug.safeParse('Mina').success).toBe(false);
    expect(Slug.safeParse('-x').success).toBe(false);
    expect(Slug.safeParse('มีนา').success).toBe(false);
  });

  it('rejects absolute paths and traversal in RelPath', () => {
    expect(RelPath.parse('refs/front.png')).toBe('refs/front.png');
    expect(RelPath.safeParse('/etc/passwd').success).toBe(false);
    expect(RelPath.safeParse('../other/x.png').success).toBe(false);
    expect(RelPath.safeParse('a/../../b').success).toBe(false);
  });

  it('formats episode folders', () => {
    expect(episodeDir(1)).toBe('ep01');
    expect(episodeDir(42)).toBe('ep42');
    expect(episodeDir(120)).toBe('ep120');
  });
});

describe('Series', () => {
  it('applies defaults (status, gates, engine, product)', () => {
    const s = Series.parse({
      id: 'cafe-secret',
      title: 'ความลับหน้าคาเฟ่',
      logline: 'บาริสต้าสาวพบว่าลูกค้าประจำคือคนที่เธอตามหามาทั้งชีวิต',
      style_id: 'live_kdrama_dub',
      aspect: '9:16',
      episodes: 3,
      ep_length_sec: 90,
      created_at: now,
      updated_at: now,
    });
    expect(s.status).toBe('planning');
    expect(s.engine_id).toBe('manual');
    expect(s.product).toBeNull();
    expect(s.gates.G1.approved).toBe(false);
    expect(s.gates.G2.approved).toBe(false);
  });

  it('rejects unknown keys (strict)', () => {
    const r = Series.safeParse({
      id: 'x', title: 't', logline: 'l', style_id: 's', aspect: '9:16', episodes: 1, ep_length_sec: 60,
      created_at: now, updated_at: now, bogus: 1,
    });
    expect(r.success).toBe(false);
  });
});

describe('Character', () => {
  it('fills lockable defaults', () => {
    const c = Character.parse({
      id: 'mina', name: 'มีนา', role: 'นางเอก', look: 'ผมยาวดำตรง ไฝใต้ตาซ้าย',
      wardrobe_default: 'เสื้อเชิ้ตขาว', personality: 'เก็บอารมณ์',
    });
    expect(c.locked).toBe(false);
    expect(c.ref_version).toBe(1);
    expect(c.refs).toEqual([]);
    expect(c.flow_character_id).toBeNull();
    expect(c.wardrobe_variants).toEqual({});
  });
});

describe('Shot', () => {
  const base = {
    id: 'ep01_s001', scene: 1, duration_sec: 3.2, type: 'CU', angle: 'eye-level', lens: '85mm',
    movement: 'slow push-in', axis_side: 'A', location: 'cafe', time: 'day',
    light_motivation: 'window left', action: 'มีนาวางแก้ว', purpose: 'เผยว่าเธอจำเขาได้', beat: 'conflict',
  };
  it('parses with defaults', () => {
    const s = Shot.parse(base);
    expect(s.batch).toBeNull();
    expect(s.dialogue).toEqual([]);
    expect(s.characters).toEqual([]);
    expect(s.style_override).toBeNull();
  });
  it('requires purpose and rejects typos in keys', () => {
    expect(Shot.safeParse({ ...base, purpose: '' }).success).toBe(false);
    expect(Shot.safeParse({ ...base, axis_cross_reson: 'x' }).success).toBe(false);
  });
});

describe('parseOrThrow', () => {
  it('throws a Thai SchemaError listing paths', () => {
    try {
      parseOrThrow(Slug, 'BAD', 'slug');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(SchemaError);
      expect((e as SchemaError).message).toContain('ไม่ผ่าน schema');
    }
  });
});
