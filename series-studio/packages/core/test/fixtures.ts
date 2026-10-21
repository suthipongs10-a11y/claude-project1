import { Bible, Outline, Script, ShotList, parsePreset } from '../src/index.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const presetDir = join(__dirname, '..', '..', '..', 'presets', 'styles');
export const kdrama = parsePreset(JSON.parse(readFileSync(join(presetDir, 'live_kdrama_dub.json'), 'utf8')));
export const thai = parsePreset(JSON.parse(readFileSync(join(presetDir, 'live_thai_drama.json'), 'utf8')));
export const ink = parsePreset(JSON.parse(readFileSync(join(presetDir, 'ink_stick.json'), 'utf8')));

export const series = { id: 'cafe-secret', aspect: '9:16' as const, ep_length_sec: 20, episodes: 3, product: null };

export const bible = Bible.parse({
  story_md: '# story',
  characters: [
    { id: 'mina', name: 'มีนา', role: 'lead', look: 'long straight black hair, small mole under left eye, medium height', wardrobe_default: 'white shirt, navy pleated skirt', wardrobe_variants: { funeral: 'black dress, pearl earrings' }, personality: 'reserved', refs: ['bible/characters/mina/refs/v1/front.png', 'bible/characters/mina/refs/v1/side.png'], locked: true },
    { id: 'tan', name: 'ตั้น', role: 'lead', look: 'short dark hair, tall, thin scar on left eyebrow', wardrobe_default: 'grey hoodie, black jeans', personality: 'quiet', refs: ['bible/characters/tan/refs/v1/front.png'], locked: true },
  ],
  locations: [
    { id: 'cafe', name: 'campus cafe', look: 'small cafe with big west-facing windows and a wooden counter', time_variants: ['day', 'night'], light_sources: ['west window'], axis_notes: 'counter screen-left', refs: ['bible/locations/cafe/refs/v1/wide_day.png'], locked: true },
  ],
  props: [{ id: 'letter', name: 'the letter', look: 'old cream envelope with red wax seal', refs: ['bible/props/letter/refs/v1/front.png'], locked: true }],
});

export const outline = Outline.parse({
  episode: 1, title: 'ลูกค้าคนนั้น', synopsis: 's', cliffhanger: 'the letter',
  beats: [
    { id: 'h', type: 'hook', summary: 'glass breaks' },
    { id: 'c', type: 'conflict', summary: 'he walks in' },
    { id: 'm', type: 'mystery', summary: 'does he remember' },
    { id: 'x', type: 'cliffhanger', summary: 'letter' },
  ],
});

export const script = Script.parse({
  episode: 1,
  scenes: [{ scene: 1, location: 'cafe', time: 'day', summary: 'morning' }],
  lines: [
    { id: 'l1', scene: 1, char: 'mina', text: 'คุณ...มาทำอะไรที่นี่', emotion: 'ตกใจกลั้นไว้' },
    { id: 'l2', scene: 1, char: 'tan', text: 'มาหาเธอ', emotion: 'นิ่ง' },
  ],
});

/** A valid 20-second, 6-shot episode (ids ep01_s001..s006) with one neutral INSERT between axis sides. */
export const shots = ShotList.parse({
  episode: 1,
  shots: [
    { id: 'ep01_s001', scene: 1, duration_sec: 3, type: 'INSERT', angle: 'top-down', lens: '50mm', movement: 'static', axis_side: 'A', location: 'cafe', time: 'day', light_motivation: 'west window', action: 'a glass slips and shatters on the wooden counter', sfx: ['glass shatter'], purpose: 'hook: something broke', beat: 'hook' },
    { id: 'ep01_s002', scene: 1, duration_sec: 4, type: 'MS', angle: 'eye-level', lens: '50mm', movement: 'static', axis_side: 'A', characters: [{ id: 'mina', screen_pos: 'right', emotion: 'startled' }], location: 'cafe', time: 'day', light_motivation: 'west window, key from screen-left', action: 'mina freezes with the tray, slowly looks up', purpose: 'establish mina', beat: 'conflict' },
    { id: 'ep01_s003', scene: 1, duration_sec: 3.5, type: 'CU', angle: 'eye-level', lens: '85mm', movement: 'slow push-in', axis_side: 'A', characters: [{ id: 'mina', screen_pos: 'right', emotion: 'holding back shock' }], location: 'cafe', time: 'day', light_motivation: 'west window, key from screen-left', action: 'mina sets the tray down and looks at the door', dialogue: [{ char: 'mina', text: 'คุณ...มาทำอะไรที่นี่', t_start: 0.6, t_end: 2.4 }], purpose: 'reveal she recognizes him', beat: 'conflict' },
    { id: 'ep01_s004', scene: 1, duration_sec: 3, type: 'INSERT', angle: 'eye-level', lens: '85mm', movement: 'static', axis_side: 'A', location: 'cafe', time: 'day', light_motivation: 'west window', action: 'an old cream envelope (the letter) lies on the counter', purpose: 'plant the letter; neutral cut to allow axis change', beat: 'mystery' },
    { id: 'ep01_s005', scene: 1, duration_sec: 3.5, type: 'OTS', angle: 'eye-level', lens: '50mm', movement: 'static', axis_side: 'B', characters: [{ id: 'tan', screen_pos: 'left', emotion: 'calm' }, { id: 'mina', screen_pos: 'right', emotion: 'tense' }], location: 'cafe', time: 'day', light_motivation: 'west window, key from screen-right', action: 'tan steps to the counter, mina does not move', dialogue: [{ char: 'tan', text: 'มาหาเธอ', t_start: 0.8, t_end: 1.8 }], purpose: 'tan answers', beat: 'mystery' },
    { id: 'ep01_s006', scene: 1, duration_sec: 3, type: 'CU', angle: 'eye-level', lens: '85mm', movement: 'static', axis_side: 'B', characters: [{ id: 'mina', screen_pos: 'right', emotion: 'eyes widen' }], location: 'cafe', time: 'day', light_motivation: 'west window', action: 'mina looks down at the letter, then up; freeze on her face', purpose: 'cliffhanger', beat: 'cliffhanger' },
  ],
});
