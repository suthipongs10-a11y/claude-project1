import { describe, expect, it } from 'vitest';
import { Continuity, planBatches, validateScript, validateShots, type Shot } from '../src/index.js';
import { bible, outline, script, series, shots } from './fixtures.js';

const ctx = { series, bible, outline, maxClipSec: 8, knownStyles: new Set(['live_kdrama_dub', 'anime']) };
const codes = (r: { errors: { code: string }[]; warnings: { code: string }[] }) => ({ e: r.errors.map((x) => x.code), w: r.warnings.map((x) => x.code) });

describe('validateShots', () => {
  it('accepts the fixture episode', () => {
    const r = validateShots(shots, ctx);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('catches axis crossing without a neutral shot or reason, and accepts a reason', () => {
    const noInsert = { ...shots, shots: shots.shots.filter((s) => s.id !== 'ep01_s004').map((s) => (s.id === 'ep01_s005' ? { ...s, duration_sec: 6.5 } : s)) };
    const r = validateShots(noInsert, ctx);
    expect(codes(r).e).toContain('shots.axis_cross');
    const withReason = { ...noInsert, shots: noInsert.shots.map((s) => (s.id === 'ep01_s005' ? { ...s, axis_cross_reason: 'tan walks around the counter in shot' } : s)) };
    expect(codes(validateShots(withReason, ctx)).e).not.toContain('shots.axis_cross');
  });

  it('requires purpose, hook first, cliffhanger last, known characters/locations, clip limit', () => {
    const bad = {
      ...shots,
      shots: shots.shots.map((s, i): Shot => {
        if (i === 0) return { ...s, beat: 'setup', purpose: '   ' };
        if (i === 1) return { ...s, characters: [{ id: 'ghost', screen_pos: 'left', emotion: 'x', wardrobe: 'default' }], location: 'moon', duration_sec: 9 };
        if (i === 5) return { ...s, beat: 'twist', style_override: 'nope' };
        return s;
      }),
    };
    const r = validateShots(bad, ctx);
    expect(codes(r).e).toEqual(expect.arrayContaining(['shots.no_purpose', 'shots.first_not_hook', 'shots.last_not_cliffhanger', 'shots.unknown_character', 'shots.unknown_location', 'shots.too_long', 'shots.unknown_style', 'shots.total_duration']));
  });

  it('checks dialogue timing: overflow, overlap, reversed, off-screen', () => {
    const bad = {
      ...shots,
      shots: shots.shots.map((s): Shot =>
        s.id === 'ep01_s003'
          ? { ...s, dialogue: [{ char: 'mina', text: 'a', t_start: 0.5, t_end: 2.0 }, { char: 'mina', text: 'b', t_start: 1.5, t_end: 4.0 }, { char: 'tan', text: 'c', t_start: 3.0, t_end: 2.0 }] }
          : s,
      ),
    };
    const r = validateShots(bad, ctx);
    expect(codes(r).e).toEqual(expect.arrayContaining(['shots.dialogue_overlap', 'shots.dialogue_overflow', 'shots.dialogue_time']));
    expect(codes(r).w).toContain('shots.dialogue_offscreen');
  });

  it('enforces continuity wardrobe on first appearance', () => {
    const continuity = Continuity.parse({ entries: [{ after_episode: 1, states: { mina: { wardrobe: 'funeral', injury: 'cut on right palm' } } }] });
    const ep2 = { ...shots, episode: 2, shots: shots.shots.map((s) => ({ ...s, id: s.id.replace('ep01', 'ep02') })) };
    const r = validateShots(ep2, { ...ctx, continuity });
    expect(codes(r).e).toContain('shots.continuity_wardrobe');
    const fixed = { ...ep2, shots: ep2.shots.map((s) => ({ ...s, characters: s.characters.map((c) => (c.id === 'mina' ? { ...c, wardrobe: 'funeral' } : c)) })) };
    expect(codes(validateShots(fixed, { ...ctx, continuity })).e).not.toContain('shots.continuity_wardrobe');
  });

  it('warns on fast dialogue and unknown time variants', () => {
    const bad = { ...shots, shots: shots.shots.map((s): Shot => (s.id === 'ep01_s003' ? { ...s, time: 'dusk', dialogue: [{ char: 'mina', text: 'คุณมาทำอะไรที่นี่ทำไมไม่บอกกันก่อนเลยนะ', t_start: 0.5, t_end: 1.0 }] } : s)) };
    const r = validateShots(bad, ctx);
    expect(codes(r).w).toEqual(expect.arrayContaining(['shots.dialogue_too_fast', 'shots.unknown_time']));
  });
});

describe('planBatches', () => {
  it('groups consecutive same-scene shots up to maxClipSec', () => {
    const plan = planBatches(shots.shots, 8);
    expect(plan.map((b) => b.shot_ids)).toEqual([['ep01_s001', 'ep01_s002'], ['ep01_s003', 'ep01_s004'], ['ep01_s005', 'ep01_s006']]);
    expect(plan.map((b) => b.id)).toEqual(['b01', 'b02', 'b03']);
    expect(plan[0]?.total_sec).toBe(7);
  });
  it('starts a new batch on scene change and is deterministic', () => {
    const two = shots.shots.map((s, i) => ({ ...s, scene: i < 2 ? 1 : 2 }));
    const plan = planBatches(two, 8);
    expect(plan[0]?.shot_ids).toEqual(['ep01_s001', 'ep01_s002']);
    expect(plan[1]?.scene).toBe(2);
    expect(JSON.stringify(planBatches(two, 8))).toBe(JSON.stringify(plan));
    expect(() => planBatches([{ ...shots.shots[0]!, duration_sec: 9 }], 8)).toThrow();
  });
});

describe('validateScript', () => {
  it('estimates timing and flags unknown chars/locations', () => {
    const { report, timing } = validateScript(script, series, bible, { syllablesPerSec: 5.5 });
    expect(report.ok).toBe(true);
    expect(timing.syllables).toBeGreaterThan(5);
    expect(timing.per_scene[0]?.scene).toBe(1);
    const bad = { ...script, lines: [...script.lines, { id: 'l3', scene: 2, char: 'nobody', text: 'x' }] };
    const r = validateScript(bad, series, bible, { syllablesPerSec: 5.5 }).report;
    expect(r.errors.map((e) => e.code)).toEqual(expect.arrayContaining(['script.unknown_char', 'script.line_scene_missing']));
  });
  it('warns when speech exceeds the episode length budget', () => {
    const long = { ...script, lines: Array.from({ length: 30 }, (_, i) => ({ id: `l${i}`, scene: 1, char: 'mina', text: 'คุณมาทำอะไรที่นี่ ฉันไม่เข้าใจเลยจริงๆ' })) };
    const r = validateScript(long, series, bible, { syllablesPerSec: 5.5 }).report;
    expect(r.warnings.map((w) => w.code)).toContain('script.too_long');
  });
});
