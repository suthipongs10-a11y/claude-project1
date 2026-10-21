import { z } from 'zod';
import { StylePreset } from '../schemas/style.js';
import { findForbiddenTerms, type ForbiddenHit } from './forbidden.js';
import { parseOrThrow } from '../util/zod.js';

export { FORBIDDEN_TERMS, findForbiddenTerms } from './forbidden.js';
export type { ForbiddenHit } from './forbidden.js';

/** Fields of a preset that end up in prompts and therefore must be free of forbidden terms. */
const PROMPT_FIELDS: ReadonlyArray<keyof StylePreset> = [
  'label',
  'render_tokens',
  'lighting',
  'grade',
  'acting',
  'negative',
  'character_sheet',
  'location_sheet',
  'cliffhanger_style',
];

export function presetPromptText(p: StylePreset): string {
  const parts: string[] = [];
  for (const f of PROMPT_FIELDS) {
    const v = p[f];
    if (Array.isArray(v)) parts.push(...v);
    else if (typeof v === 'string') parts.push(v);
  }
  parts.push(...p.camera.movement_vocab, p.camera.lens_default, p.camera.lens_closeup);
  return parts.join('\n');
}

/** Validate a preset object (schema + forbidden terms). Throws a user-facing error. */
export function parsePreset(data: unknown, source = 'preset'): StylePreset {
  const preset = parseOrThrow(StylePreset, data, `style preset (${source})`);
  const hits: ForbiddenHit[] = findForbiddenTerms(presetPromptText(preset));
  if (hits.length) {
    const list = hits.map((h) => `"${h.term}"`).join(', ');
    throw new Error(`preset ${preset.id} มีคำที่ห้ามใช้ (ชื่อสตูดิโอ/ตัวละครที่มีลิขสิทธิ์): ${list}`);
  }
  return preset;
}

export const StylePresetList = z.array(StylePreset);

/** Short summary used by list_styles. */
export function summarizePreset(p: StylePreset): {
  id: string;
  label: string;
  medium: StylePreset['medium'];
  dialogue_mode: StylePreset['dialogue_mode'];
  aspect_modes: StylePreset['camera']['aspect_modes'];
  notes?: string;
} {
  return {
    id: p.id,
    label: p.label,
    medium: p.medium,
    dialogue_mode: p.dialogue_mode,
    aspect_modes: p.camera.aspect_modes,
    ...(p.notes !== undefined ? { notes: p.notes } : {}),
  };
}
