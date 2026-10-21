import { describe, expect, it } from 'vitest';
import { planBatches, planDubCues } from '../src/index.js';
import { shots } from './fixtures.js';

const batches = planBatches(shots.shots, 8).map((b) => ({ id: b.id, shot_ids: b.shot_ids, total_sec: b.total_sec }));
const voices = { mina: { voice_id: 'v_mina', lang: 'th' }, tan: { voice_id: 'v_tan', lang: 'th' }, NARRATOR: { voice_id: 'v_narr', lang: 'th' } };

describe('planDubCues', () => {
  it('positions cues on the content timeline with each character voice (dub)', () => {
    const { cues, report, content_sec } = planDubCues(shots.shots, batches, 'dub', voices);
    expect(report.ok).toBe(true);
    expect(content_sec).toBe(20);
    expect(cues.map((c) => [c.shot_id, c.speaker, c.voice_id, c.start_sec, c.end_sec])).toEqual([
      ['ep01_s003', 'mina', 'v_mina', 7.6, 9.4],
      ['ep01_s005', 'tan', 'v_tan', 14.3, 15.3],
    ]);
  });
  it('narration mode routes every line to the NARRATOR voice', () => {
    const { cues } = planDubCues(shots.shots, batches, 'narration', voices);
    expect(cues.every((c) => c.speaker === 'NARRATOR' && c.voice_id === 'v_narr')).toBe(true);
    expect(cues[0]?.char).toBe('mina');
  });
  it('reports missing voices and refuses native/sfx modes', () => {
    const r = planDubCues(shots.shots, batches, 'dub', { mina: voices.mina });
    expect(r.report.ok).toBe(false);
    expect(r.report.errors.map((e) => e.at)).toEqual(['tan']);
    expect(planDubCues(shots.shots, batches, 'narration', {}).report.errors[0]?.message).toContain('NARRATOR');
    expect(planDubCues(shots.shots, batches, 'native', voices).report.ok).toBe(false);
  });
});
