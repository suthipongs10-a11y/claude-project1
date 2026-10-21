import { describe, expect, it } from 'vitest';
import { Prop, compileBatchPrompt, deriveContinuity, validateContinuity, validateShots, type Shot } from '../src/index.js';
import { bible, kdrama, outline, series, shots } from './fixtures.js';

const product = { name: 'ครีมกันแดด X', prop_id: 'cream', selling_points: ['กันน้ำ', 'ไม่เหนียว', 'SPF50'], cta: 'สั่งซื้อที่ลิงก์', bridge_episodes: [3] };
const cream = Prop.parse({ id: 'cream', name: 'ครีมกันแดด X', look: 'white tube with a blue cap', is_product: true, refs: ['bible/props/cream/refs/v1/front.png'], locked: true });
const bibleP = { ...bible, props: [...bible.props, cream] };
const base = { series: { ...series, product }, bible: bibleP, outline, maxClipSec: 8, knownStyles: new Set(['live_kdrama_dub']) };
const codes = (r: { errors: { code: string }[] }) => r.errors.map((e) => e.code);

describe('product mode shot rules', () => {
  it('bridge episodes need a bridge shot showing the product; others may not have bridge shots', () => {
    const ep3 = { episode: 3, shots: shots.shots.map((s) => ({ ...s, id: s.id.replace('ep01', 'ep03') })) };
    expect(codes(validateShots(ep3, base))).toContain('shots.bridge_required');
    const withBridgeNoProduct = { ...ep3, shots: ep3.shots.map((s, i): Shot => (i === 4 ? { ...s, beat: 'bridge' } : s)) };
    expect(codes(validateShots(withBridgeNoProduct, base))).toContain('shots.bridge_without_product');
    const good = { ...ep3, shots: ep3.shots.map((s, i): Shot => (i === 4 ? { ...s, beat: 'bridge', props: ['cream'], action: 'tan slides the sunscreen across the counter' } : s)) };
    expect(validateShots(good, base).ok).toBe(true);
    const ep2 = { ...good, episode: 2, shots: good.shots.map((s) => ({ ...s, id: s.id.replace('ep03', 'ep02') })) };
    expect(codes(validateShots(ep2, base))).toContain('shots.bridge_not_allowed');
    expect(codes(validateShots(ep2, { ...base, series: { ...series, product: null } }))).toContain('shots.bridge_without_product_mode');
    expect(codes(validateShots({ ...good, shots: good.shots.map((s) => ({ ...s, props: ['ghost'] })) }, base))).toContain('shots.unknown_prop');
  });
});

describe('compiler: props and continuity carry-over', () => {
  it('adds a [PROPS] line, attaches prop refs and injects carried injuries/holding', () => {
    const shot: Shot = { ...shots.shots[4]!, props: ['cream'] };
    const c = compileBatchPrompt([shot], kdrama, series, bibleP, { carryOver: { mina: { wardrobe: 'funeral', injury: 'cut on right palm', holding: 'the letter' }, tan: { appearance: 'wet hair' } }, wardrobeOverrides: { mina: 'funeral' } });
    expect(c.prompt).toContain('[PROPS] cream: white tube with a blue cap');
    expect(c.prompt).toContain('mina: long straight black hair, small mole under left eye, medium height, wearing black dress, pearl earrings, visible cut on right palm, holding the letter, at right');
    expect(c.prompt).toContain('tan: short dark hair, tall, thin scar on left eyebrow, wearing grey hoodie, black jeans, wet hair, at left');
    expect(c.ref_images).toContain('bible/props/cream/refs/v1/front.png');
  });
});

describe('deriveContinuity', () => {
  it('takes the last wardrobe per character and carries other fields forward, with overrides and clears', () => {
    const prev = { after_episode: 1, states: { mina: { wardrobe: 'default', injury: 'cut on right palm', state: 'knows the secret' }, tan: { wardrobe: 'default' } } };
    const ep2 = shots.shots.map((s) => ({ ...s, characters: s.characters.map((c) => (c.id === 'mina' && s.id === 'ep01_s006' ? { ...c, wardrobe: 'funeral' } : c)) }));
    const e = deriveContinuity(2, ep2, prev, { tan: { holding: 'umbrella' }, mina: { injury: '' } });
    expect(e.after_episode).toBe(2);
    expect(e.states['mina']).toEqual({ wardrobe: 'funeral', state: 'knows the secret' });
    expect(e.states['tan']).toEqual({ wardrobe: 'default', holding: 'umbrella' });
    const r = validateContinuity({ after_episode: 2, states: { mina: { wardrobe: 'random' }, ghost: {} } }, bible.characters);
    expect(r.errors.map((x) => x.code)).toEqual(['continuity.unknown_character']);
    expect(r.warnings.map((x) => x.code)).toEqual(['continuity.wardrobe_freeform']);
  });
});
