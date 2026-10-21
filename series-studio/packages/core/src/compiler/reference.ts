import type { Character, Location, Prop, StylePreset } from '../schemas/index.js';

/**
 * Deterministic reference-image prompts (SPEC §8.2). No LLM involved: the same preset and
 * entity always produce the same text, so every reference is described identically.
 */

const EXPRESSIONS = ['happy', 'angry', 'sad', 'surprised', 'fearful', 'determined'] as const;

/** Expand "front, 3/4, side, full body, 3 expressions" into concrete view names. */
export function expandSheetViews(sheet: string): string[] {
  const out: string[] = [];
  for (const raw of sheet.split(',')) {
    const v = raw.trim();
    if (!v) continue;
    const m = /^(\d+)\s+expressions?$/i.exec(v);
    if (m) {
      const n = Math.min(Number(m[1]), EXPRESSIONS.length);
      for (let i = 0; i < n; i++) out.push(`expression: ${EXPRESSIONS[i]}`);
    } else {
      out.push(v);
    }
  }
  return out;
}

function styleBlock(p: StylePreset): string {
  return `[STYLE] ${[...p.render_tokens, p.grade].join(', ')}`;
}

function avoidBlock(p: StylePreset, extra: string[] = []): string {
  return `[AVOID] ${[...p.negative, ...extra].join(', ')}`;
}

export function characterRefPrompt(p: StylePreset, c: Character, view: string, aspect = '1:1'): string {
  const lines = [
    styleBlock(p),
    `[SHEET] character reference sheet, view: ${view}, aspect ${aspect}, plain neutral background, consistent identity`,
    `[CHARACTER] ${c.look}, wearing ${c.wardrobe_default}`,
    `[LIGHTING] ${p.lighting}`,
    avoidBlock(p, ['other people', 'props that hide the face', 'text', 'watermark']),
  ];
  return lines.join('\n');
}

export function locationRefPrompt(p: StylePreset, l: Location, view: string, aspect: string): string {
  const look = l.look ? `${l.name}: ${l.look}` : l.name;
  const light = l.light_sources.length ? `, light sources: ${l.light_sources.join(', ')}` : '';
  const axis = l.axis_notes ? ` (${l.axis_notes})` : '';
  const lines = [
    styleBlock(p),
    `[SHEET] location reference, ${p.location_sheet}, view: ${view}, aspect ${aspect}`,
    `[LOCATION] ${look}${light}${axis}`,
    `[LIGHTING] ${p.lighting}`,
    avoidBlock(p, ['people', 'animals', 'vehicles in motion', 'text', 'watermark']),
  ];
  return lines.join('\n');
}

export function propRefPrompt(p: StylePreset, prop: Prop, view: string, aspect = '1:1'): string {
  const lines = [
    styleBlock(p),
    `[SHEET] ${prop.is_product ? 'product packshot' : 'prop packshot'}, view: ${view}, aspect ${aspect}, plain studio background, centered, sharp focus`,
    `[PROP] ${prop.name}: ${prop.look}`,
    `[LIGHTING] soft studio light, gentle reflections`,
    avoidBlock(p, ['hands', 'people', 'text', 'watermark']),
  ];
  return lines.join('\n');
}

/** Default views per entity type, derived from the preset. */
export function defaultViews(p: StylePreset, kind: 'character' | 'location' | 'prop', timeVariants: string[] = []): string[] {
  if (kind === 'character') return expandSheetViews(p.character_sheet);
  if (kind === 'location') return (timeVariants.length ? timeVariants : ['day']).map((t) => `wide ${t}`);
  return ['front', '3/4', 'detail'];
}
