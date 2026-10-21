import type { Character, CharacterState, ContinuityEntry, Shot } from '../schemas/index.js';
import { error, makeReport, warning, type Issue, type ValidationReport } from '../util/result.js';

/**
 * Derive the end-of-episode state of every character from the shot list: the wardrobe worn in
 * their last shot, with injury/holding/appearance/state carried forward from the previous
 * episode unless overridden. Deterministic, so Claude only has to supply what changed.
 */
export function deriveContinuity(
  episode: number,
  shots: readonly Shot[],
  previous: ContinuityEntry | undefined,
  overrides: Readonly<Record<string, CharacterState>> = {},
): ContinuityEntry {
  const states: Record<string, CharacterState> = {};
  if (previous) for (const [id, st] of Object.entries(previous.states)) states[id] = { ...st };
  for (const s of shots) {
    for (const c of s.characters) {
      const prev = states[c.id] ?? {};
      states[c.id] = { ...prev, wardrobe: c.wardrobe };
    }
  }
  for (const [id, st] of Object.entries(overrides)) {
    const base = states[id] ?? {};
    const merged: CharacterState = { ...base };
    for (const [k, v] of Object.entries(st) as Array<[keyof CharacterState, string | undefined]>) {
      if (v === undefined) continue;
      if (v === '') delete merged[k]; // explicit clear (e.g. injury healed)
      else merged[k] = v;
    }
    states[id] = merged;
  }
  return { after_episode: episode, states };
}

/** Code checks on a continuity entry against the bible. */
export function validateContinuity(entry: ContinuityEntry, characters: readonly Character[]): ValidationReport {
  const issues: Issue[] = [];
  const byId = new Map(characters.map((c) => [c.id, c]));
  for (const [id, st] of Object.entries(entry.states)) {
    const c = byId.get(id);
    if (!c) {
      issues.push(error('continuity.unknown_character', `ตัวละคร "${id}" ไม่มีใน bible`, id));
      continue;
    }
    if (st.wardrobe && st.wardrobe !== 'default' && !(st.wardrobe in c.wardrobe_variants))
      issues.push(warning('continuity.wardrobe_freeform', `wardrobe "${st.wardrobe}" ของ ${id} ไม่ใช่ default/variant ที่ประกาศ`, id));
  }
  return makeReport(issues);
}
