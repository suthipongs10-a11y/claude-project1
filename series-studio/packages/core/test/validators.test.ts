import { describe, expect, it } from 'vitest';
import { Bible, Outline, validateBible, validateOutline } from '../src/index.js';

const series = { episodes: 3, ep_length_sec: 90, product: null } as const;

const bible = Bible.parse({
  story_md: '# เรื่อง\nบาริสต้ากับลูกค้าประจำ',
  characters: [
    { id: 'mina', name: 'มีนา', role: 'นางเอก', look: 'long straight black hair, small mole under left eye', wardrobe_default: 'white shirt, navy pleated skirt', personality: 'เก็บอารมณ์' },
    { id: 'tan', name: 'ตั้น', role: 'พระเอก', look: 'short hair, tall, scar on left brow', wardrobe_default: 'grey hoodie', personality: 'พูดน้อย' },
  ],
  locations: [{ id: 'cafe', name: 'คาเฟ่หน้ามหาลัย', time_variants: ['day', 'night'], light_sources: ['west window'], axis_notes: 'counter always screen-left' }],
  props: [{ id: 'letter', name: 'จดหมาย', look: 'old cream envelope with red wax seal' }],
  voices: { mina: { voice_id: 'v_mina' } },
});

describe('validateBible', () => {
  it('passes a well-formed bible', () => {
    expect(validateBible(bible, series).ok).toBe(true);
  });
  it('flags duplicate ids, unknown voice chars and forbidden terms', () => {
    const bad = Bible.parse({
      ...bible,
      characters: [...bible.characters, { ...bible.characters[0], look: 'looks like Elsa from the movie' }],
      voices: { ghost: { voice_id: 'x' } },
    });
    const r = validateBible(bad, series);
    expect(r.ok).toBe(false);
    const codes = r.errors.map((e) => e.code);
    expect(codes).toContain('bible.duplicate_id');
    expect(codes).toContain('bible.voice_unknown_char');
    expect(codes).toContain('bible.forbidden_term');
  });
  it('requires the product prop in product mode and warns about missing refs when asked', () => {
    const r = validateBible(bible, { product: { name: 'ครีม', prop_id: 'cream', selling_points: ['a'], cta: 'ซื้อ', bridge_episodes: [3] } });
    expect(r.errors.map((e) => e.code)).toContain('bible.product_prop_missing');
    const r2 = validateBible(bible, series, { requireRefs: true });
    expect(r2.ok).toBe(true);
    expect(r2.warnings.filter((w) => w.code === 'bible.no_refs').length).toBe(4);
  });
  it('supports per-series extra forbidden terms', () => {
    const r = validateBible(bible, series, { extraForbidden: ['navy pleated'] });
    expect(r.ok).toBe(false);
  });
});

describe('validateOutline', () => {
  const good = Outline.parse({
    episode: 1,
    title: 'ลูกค้าคนนั้น',
    synopsis: 'มีนาเจอตั้นอีกครั้ง',
    cliffhanger: 'ตั้นวางจดหมายบนเคาน์เตอร์',
    beats: [
      { id: 'b1', type: 'hook', summary: 'แก้วแตก', est_sec: 5 },
      { id: 'b2', type: 'setup', summary: 'เช้าปกติ', est_sec: 20 },
      { id: 'b3', type: 'conflict', summary: 'เขาเดินเข้ามา', est_sec: 25 },
      { id: 'b4', type: 'mystery', summary: 'เขาจำเธอได้?', est_sec: 20 },
      { id: 'b5', type: 'twist', summary: 'เขาเรียกชื่อเดิมของเธอ', est_sec: 12 },
      { id: 'b6', type: 'cliffhanger', summary: 'จดหมาย', est_sec: 8 },
    ],
  });
  it('passes hook→…→cliffhanger with matching length', () => {
    const r = validateOutline(good, series);
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([]);
  });
  it('requires hook first and cliffhanger last', () => {
    const r = validateOutline({ ...good, beats: [good.beats[1]!, good.beats[0]!, good.beats[2]!] }, series);
    expect(r.errors.map((e) => e.code)).toEqual(expect.arrayContaining(['outline.no_hook', 'outline.no_cliffhanger']));
  });
  it('enforces bridge rules for product mode', () => {
    const withBridge = { ...good, beats: [...good.beats.slice(0, 5), { id: 'br', type: 'bridge' as const, summary: 'สินค้า', est_sec: 1 }, good.beats[5]!] };
    expect(validateOutline(withBridge, series).errors.map((e) => e.code)).toContain('outline.bridge_without_product');
    const product = { name: 'x', prop_id: 'p', selling_points: ['a'], cta: 'c', bridge_episodes: [1] };
    expect(validateOutline(withBridge, { ...series, product }).ok).toBe(true);
    expect(validateOutline(good, { ...series, product }).errors.map((e) => e.code)).toContain('outline.bridge_required');
    expect(validateOutline({ ...withBridge, episode: 2 }, { ...series, product }).errors.map((e) => e.code)).toContain('outline.bridge_not_allowed');
  });
  it('warns when est_sec total drifts from the episode length', () => {
    const r = validateOutline({ ...good, beats: good.beats.map((b) => ({ ...b, est_sec: 30 })) }, series);
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.code)).toContain('outline.length_mismatch');
  });
});
