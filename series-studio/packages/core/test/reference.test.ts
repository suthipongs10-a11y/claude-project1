import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Character, Location, Prop, characterRefPrompt, defaultViews, expandSheetViews, locationRefPrompt, parsePreset, propRefPrompt, slugify } from '../src/index.js';

const preset = parsePreset(JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'presets', 'styles', 'live_kdrama_dub.json'), 'utf8')));

describe('reference prompt compiler', () => {
  it('expands sheet views deterministically', () => {
    expect(expandSheetViews('front, 3/4, side, full body, 3 expressions')).toEqual([
      'front', '3/4', 'side', 'full body', 'expression: happy', 'expression: angry', 'expression: sad',
    ]);
    expect(defaultViews(preset, 'location', ['day', 'night'])).toEqual(['wide day', 'wide night']);
    expect(defaultViews(preset, 'prop')).toEqual(['front', '3/4', 'detail']);
  });

  it('matches snapshots (same input => same prompt, byte for byte)', () => {
    const c = Character.parse({ id: 'mina', name: 'มีนา', role: 'lead', look: 'long straight black hair, small mole under left eye, medium height', wardrobe_default: 'white shirt, navy pleated skirt', personality: 'reserved' });
    const l = Location.parse({ id: 'cafe', name: 'campus cafe', look: 'small cafe with big west-facing windows', time_variants: ['day'], light_sources: ['west window', 'pendant lamps over counter'], axis_notes: 'counter always screen-left' });
    const p = Prop.parse({ id: 'letter', name: 'the letter', look: 'old cream envelope with red wax seal' });
    const a = characterRefPrompt(preset, c, 'front');
    expect(a).toBe(characterRefPrompt(preset, c, 'front'));
    expect(a).toMatchInlineSnapshot(`
      "[STYLE] cinematic Korean drama, soft pastel grade, shallow depth of field, clean skin texture, photoreal, lifted blacks, pastel skin tones
      [SHEET] character reference sheet, view: front, aspect 1:1, plain neutral background, consistent identity
      [CHARACTER] long straight black hair, small mole under left eye, medium height, wearing white shirt, navy pleated skirt
      [LIGHTING] motivated practical lights, soft key, warm rim
      [AVOID] text overlays, watermark, extra people in background, logo, subtitles burned in, other people, props that hide the face, text, watermark"
    `);
    expect(locationRefPrompt(preset, l, 'wide day', '9:16')).toMatchInlineSnapshot(`
      "[STYLE] cinematic Korean drama, soft pastel grade, shallow depth of field, clean skin texture, photoreal, lifted blacks, pastel skin tones
      [SHEET] location reference, wide empty establishing, no people, view: wide day, aspect 9:16
      [LOCATION] campus cafe: small cafe with big west-facing windows, light sources: west window, pendant lamps over counter (counter always screen-left)
      [LIGHTING] motivated practical lights, soft key, warm rim
      [AVOID] text overlays, watermark, extra people in background, logo, subtitles burned in, people, animals, vehicles in motion, text, watermark"
    `);
    expect(propRefPrompt(preset, p, 'front')).toMatchInlineSnapshot(`
      "[STYLE] cinematic Korean drama, soft pastel grade, shallow depth of field, clean skin texture, photoreal, lifted blacks, pastel skin tones
      [SHEET] prop packshot, view: front, aspect 1:1, plain studio background, centered, sharp focus
      [PROP] the letter: old cream envelope with red wax seal
      [LIGHTING] soft studio light, gentle reflections
      [AVOID] text overlays, watermark, extra people in background, logo, subtitles burned in, hands, people, text, watermark"
    `);
  });
});

describe('slugify', () => {
  it('makes ascii slugs and returns empty for Thai-only text', () => {
    expect(slugify('Cafe Secret: Season 1!')).toBe('cafe-secret-season-1');
    expect(slugify('ความลับหน้าคาเฟ่')).toBe('');
  });
});
