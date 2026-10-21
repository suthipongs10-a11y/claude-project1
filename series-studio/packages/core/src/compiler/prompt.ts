import type { Bible, Character, Location, Series, Shot, StylePreset } from '../schemas/index.js';
import { NARRATOR_ID } from '../schemas/bible.js';

/**
 * Deterministic shot/batch prompt compiler (SPEC §8.5, CLAUDE.md rule 2).
 * Pure function of (preset, series, bible, shots, options): no LLM, no clock, no randomness.
 * Snapshot-tested. Character `look` text is pasted verbatim so every shot describes a
 * character identically.
 */
export interface CompileOptions {
  /** Presets available for style_override, by id. */
  presets?: ReadonlyMap<string, StylePreset> | undefined;
  /** Notes from QC/regen appended as a [FIX] block (SPEC §8.7). */
  fixNotes?: string | undefined;
  /** Override wardrobe per character id for this episode (continuity carry-over). */
  wardrobeOverrides?: Readonly<Record<string, string>> | undefined;
}

export interface CompiledBatch {
  prompt: string;
  /** Reference image paths for all characters/locations/props appearing in the batch (deduplicated, stable order). */
  ref_images: string[];
  shot_ids: string[];
  total_sec: number;
}

const LANG_NAME: Record<string, string> = { th: 'Thai', ko: 'Korean', en: 'English', zh: 'Mandarin Chinese', ja: 'Japanese' };

export function t(n: number): string {
  return n.toFixed(1);
}

function resolveWardrobe(c: Character, wardrobe: string, overrides?: Readonly<Record<string, string>>): string {
  const w = wardrobe === 'default' && overrides?.[c.id] ? overrides[c.id]! : wardrobe;
  if (w === 'default') return c.wardrobe_default;
  const variant = c.wardrobe_variants[w];
  return variant ?? w;
}

function dialogueLines(shot: Shot, preset: StylePreset, chars: ReadonlyMap<string, Character>, offset: number): string[] {
  if (shot.dialogue.length === 0) {
    return preset.dialogue_mode === 'narration' || preset.dialogue_mode === 'sfx_only'
      ? ['[DIALOGUE] none in-model (voice-over added in post); mouths closed unless the action says otherwise']
      : ['[DIALOGUE] none'];
  }
  const lang = LANG_NAME[preset.dialogue_lang_in_model] ?? preset.dialogue_lang_in_model;
  return shot.dialogue.map((d) => {
    const who = d.char === NARRATOR_ID ? 'narrator (voice-over)' : (chars.get(d.char)?.id ?? d.char);
    const span = `${t(offset + d.t_start)}–${t(offset + d.t_end)}s`;
    switch (preset.dialogue_mode) {
      case 'native':
        return `[DIALOGUE] ${who} (${span}) speaks ${lang}: "${d.text}"`;
      case 'dub':
        return `[DIALOGUE] ${who} (${span}) speaks ${lang} with natural mouth movement (will be dubbed), meaning: "${d.text}"`;
      case 'narration':
        return `[DIALOGUE] ${who} (${span}) voice-over only, not spoken on camera: "${d.text}"`;
      case 'sfx_only':
        return `[DIALOGUE] ${who} (${span}) no speech audio; gesture conveys: "${d.text}"`;
    }
  });
}

/** Compile one shot into its block. `offset` = seconds from the start of the clip. */
export function compileShotBlock(
  shot: Shot,
  index: number,
  offset: number,
  preset: StylePreset,
  series: Pick<Series, 'aspect'>,
  bible: Pick<Bible, 'characters' | 'locations'>,
  opts: CompileOptions = {},
): string {
  const chars = new Map(bible.characters.map((c) => [c.id, c]));
  const locs = new Map(bible.locations.map((l) => [l.id, l]));
  const stylePreset = shot.style_override ? opts.presets?.get(shot.style_override) : undefined;
  const lines: string[] = [];
  lines.push(`[SHOT ${index + 1} | ${t(offset)}–${t(offset + shot.duration_sec)}s | ${shot.id} | beat: ${shot.beat}]`);
  if (stylePreset) lines.push(`[STYLE OVERRIDE] ${[...stylePreset.render_tokens, stylePreset.grade].join(', ')} (${shot.style_override})`);
  lines.push(`[CAMERA] ${shot.type} ${shot.angle}, ${shot.lens}, ${shot.movement}, ${series.aspect}`);
  const loc: Location | undefined = locs.get(shot.location);
  const locName = loc ? (loc.look ? `${loc.name} (${loc.look})` : loc.name) : shot.location;
  lines.push(`[LOCATION] ${locName}, ${shot.time}, light: ${shot.light_motivation}`);
  if (shot.characters.length === 0) lines.push('[CHARACTERS] none in frame');
  for (const sc of shot.characters) {
    const c = chars.get(sc.id);
    const look = c ? c.look : `(unknown character ${sc.id})`;
    const wardrobe = c ? resolveWardrobe(c, sc.wardrobe, opts.wardrobeOverrides) : sc.wardrobe;
    lines.push(`[CHARACTERS] ${sc.id}: ${look}, wearing ${wardrobe}, at ${sc.screen_pos}, ${sc.emotion}`);
  }
  lines.push(`[ACTION] ${t(offset)}–${t(offset + shot.duration_sec)}s: ${shot.action}`);
  lines.push(...dialogueLines(shot, preset, chars, offset));
  if (shot.sfx.length) lines.push(`[SFX] ${shot.sfx.join(', ')}`);
  return lines.join('\n');
}

/** Compile a batch of consecutive shots into one clip prompt. */
export function compileBatchPrompt(
  shots: readonly Shot[],
  preset: StylePreset,
  series: Pick<Series, 'aspect'>,
  bible: Pick<Bible, 'characters' | 'locations' | 'props'>,
  opts: CompileOptions = {},
): CompiledBatch {
  if (shots.length === 0) throw new Error('batch ว่าง');
  const total = shots.reduce((s, x) => s + x.duration_sec, 0);
  const lines: string[] = [];
  lines.push(`[STYLE] ${[...preset.render_tokens, preset.grade].join(', ')}`);
  lines.push(`[LIGHTING] ${preset.lighting}`);
  lines.push(`[ACTING] ${preset.acting}`);
  lines.push(`[CLIP] ${shots.length} shot${shots.length > 1 ? 's' : ''}, ${t(total)}s total, ${series.aspect}, hard cuts between shots exactly at the listed times, continuous time within the scene`);
  let offset = 0;
  for (const [i, s] of shots.entries()) {
    lines.push('');
    lines.push(compileShotBlock(s, i, offset, preset, series, bible, opts));
    offset += s.duration_sec;
  }
  lines.push('');
  lines.push('[CONSISTENCY] every character keeps the exact same face, hair, body and wardrobe as the attached references across all shots');
  if (opts.fixNotes) lines.push(`[FIX] ${opts.fixNotes.trim()}`);
  lines.push(`[AVOID] ${preset.negative.join(', ')}`);

  const refs: string[] = [];
  const push = (list: string[]) => {
    for (const r of list) if (!refs.includes(r)) refs.push(r);
  };
  const charIds = [...new Set(shots.flatMap((s) => s.characters.map((c) => c.id)))];
  for (const id of charIds) push(bible.characters.find((c) => c.id === id)?.refs ?? []);
  const locIds = [...new Set(shots.map((s) => s.location))];
  for (const id of locIds) push(bible.locations.find((l) => l.id === id)?.refs ?? []);
  // props mentioned by id in action text or sfx
  for (const p of bible.props) {
    if (shots.some((s) => s.action.includes(p.id) || s.action.includes(p.name))) push(p.refs);
  }
  return { prompt: lines.join('\n'), ref_images: refs, shot_ids: shots.map((s) => s.id), total_sec: Math.round(total * 10) / 10 };
}
