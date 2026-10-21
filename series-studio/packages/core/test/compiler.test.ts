import { describe, expect, it } from 'vitest';
import { compileBatchPrompt, planBatches } from '../src/index.js';
import { bible, ink, kdrama, series, shots, thai } from './fixtures.js';

describe('prompt compiler', () => {
  const b02 = shots.shots.slice(2, 4);

  it('is deterministic and collects refs in stable order', () => {
    const a = compileBatchPrompt(b02, kdrama, series, bible);
    const b = compileBatchPrompt(b02, kdrama, series, bible);
    expect(a.prompt).toBe(b.prompt);
    expect(a.ref_images).toEqual([
      'bible/characters/mina/refs/v1/front.png',
      'bible/characters/mina/refs/v1/side.png',
      'bible/locations/cafe/refs/v1/wide_day.png',
      'bible/props/letter/refs/v1/front.png',
    ]);
    expect(a.total_sec).toBe(6.5);
  });

  it('matches the dub snapshot', () => {
    expect(compileBatchPrompt(b02, kdrama, series, bible).prompt).toMatchInlineSnapshot(`
      "[STYLE] cinematic Korean drama, soft pastel grade, shallow depth of field, clean skin texture, photoreal, lifted blacks, pastel skin tones
      [LIGHTING] motivated practical lights, soft key, warm rim
      [ACTING] restrained, lingering eye contact, reaction shots held 1-2s
      [CLIP] 2 shots, 6.5s total, 9:16, hard cuts between shots exactly at the listed times, continuous time within the scene

      [SHOT 1 | 0.0–3.5s | ep01_s003 | beat: conflict]
      [CAMERA] CU eye-level, 85mm, slow push-in, 9:16
      [LOCATION] campus cafe (small cafe with big west-facing windows and a wooden counter), day, light: west window, key from screen-left
      [CHARACTERS] mina: long straight black hair, small mole under left eye, medium height, wearing white shirt, navy pleated skirt, at right, holding back shock
      [ACTION] 0.0–3.5s: mina sets the tray down and looks at the door
      [DIALOGUE] mina (0.6–2.4s) speaks Korean with natural mouth movement (will be dubbed), meaning: "คุณ...มาทำอะไรที่นี่"

      [SHOT 2 | 3.5–6.5s | ep01_s004 | beat: mystery]
      [CAMERA] INSERT eye-level, 85mm, static, 9:16
      [LOCATION] campus cafe (small cafe with big west-facing windows and a wooden counter), day, light: west window
      [CHARACTERS] none in frame
      [ACTION] 3.5–6.5s: an old cream envelope (the letter) lies on the counter
      [DIALOGUE] none

      [CONSISTENCY] every character keeps the exact same face, hair, body and wardrobe as the attached references across all shots
      [AVOID] text overlays, watermark, extra people in background, logo, subtitles burned in"
    `);
  });

  it('renders native dialogue, narration mode, wardrobe variants/overrides, style override and fix notes', () => {
    const native = compileBatchPrompt([shots.shots[2]!], thai, series, bible).prompt;
    expect(native).toContain('speaks Thai: "คุณ...มาทำอะไรที่นี่"');
    const narration = compileBatchPrompt([shots.shots[2]!], ink, series, bible).prompt;
    expect(narration).toContain('voice-over only');
    const variant = compileBatchPrompt(
      [{ ...shots.shots[2]!, characters: [{ id: 'mina', screen_pos: 'right', emotion: 'x', wardrobe: 'funeral' }], style_override: 'ink_stick' }],
      kdrama, series, bible, { presets: new Map([['ink_stick', ink]]), fixNotes: 'keep the mole under the left eye visible' },
    ).prompt;
    expect(variant).toContain('wearing black dress, pearl earrings');
    expect(variant).toContain('[STYLE OVERRIDE] black ink stick-figure characters');
    expect(variant).toContain('[FIX] keep the mole under the left eye visible');
    const carried = compileBatchPrompt([shots.shots[2]!], kdrama, series, bible, { wardrobeOverrides: { mina: 'funeral' } }).prompt;
    expect(carried).toContain('wearing black dress, pearl earrings');
  });

  it('compiles every batch of the fixture episode', () => {
    const plan = planBatches(shots.shots, 8);
    for (const b of plan) {
      const c = compileBatchPrompt(b.shot_ids.map((id) => shots.shots.find((s) => s.id === id)!), kdrama, series, bible);
      expect(c.shot_ids).toEqual(b.shot_ids);
      expect(c.prompt.startsWith('[STYLE]')).toBe(true);
    }
  });
});
