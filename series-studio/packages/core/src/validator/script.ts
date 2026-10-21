import type { Bible, Script, Series } from '../schemas/index.js';
import { NARRATOR_ID } from '../schemas/bible.js';
import { countSyllables } from '../text/thai.js';
import { error, makeReport, warning, type Issue, type ValidationReport } from '../util/result.js';

export interface ScriptValidationOptions {
  syllablesPerSec: number;
  /** Fraction of the episode that may be speech before warning (default 0.85). */
  maxSpeechRatio?: number | undefined;
}

export interface ScriptTiming {
  syllables: number;
  est_speech_sec: number;
  ep_length_sec: number;
  per_scene: Array<{ scene: number; syllables: number; est_sec: number }>;
}

/** Structure checks + Thai syllable timing estimate (SPEC §8.3). */
export function validateScript(script: Script, series: Pick<Series, 'ep_length_sec' | 'episodes'>, bible: Pick<Bible, 'characters' | 'locations'>, opts: ScriptValidationOptions): { report: ValidationReport; timing: ScriptTiming } {
  const issues: Issue[] = [];
  const chars = new Set(bible.characters.map((c) => c.id));
  const locs = new Set(bible.locations.map((l) => l.id));
  const scenes = new Map<number, Script['scenes'][number]>();
  if (script.episode > series.episodes) issues.push(error('script.episode_out_of_range', `ตอนที่ ${script.episode} เกินจำนวนตอน (${series.episodes})`));
  for (const sc of script.scenes) {
    if (scenes.has(sc.scene)) issues.push(error('script.duplicate_scene', `scene ${sc.scene} ซ้ำ`, `scene ${sc.scene}`));
    scenes.set(sc.scene, sc);
    if (!locs.has(sc.location)) issues.push(error('script.unknown_location', `scene ${sc.scene} ใช้ location "${sc.location}" ที่ไม่มีใน bible`, `scene ${sc.scene}`));
  }
  const ids = new Set<string>();
  const perScene = new Map<number, number>();
  let syllables = 0;
  for (const line of script.lines) {
    if (ids.has(line.id)) issues.push(error('script.duplicate_line', `line id "${line.id}" ซ้ำ`, line.id));
    ids.add(line.id);
    if (!scenes.has(line.scene)) issues.push(error('script.line_scene_missing', `บรรทัด ${line.id} อยู่ใน scene ${line.scene} ที่ไม่ได้ประกาศ`, line.id));
    if (line.char !== NARRATOR_ID && !chars.has(line.char)) issues.push(error('script.unknown_char', `บรรทัด ${line.id} พูดโดย "${line.char}" ที่ไม่มีใน bible`, line.id));
    const n = countSyllables(line.text);
    syllables += n;
    perScene.set(line.scene, (perScene.get(line.scene) ?? 0) + n);
    if (n / opts.syllablesPerSec > 6) issues.push(warning('script.long_line', `บรรทัด ${line.id} ยาว ≈ ${(n / opts.syllablesPerSec).toFixed(1)} วิ ควรแบ่งเป็นช็อตย่อย`, line.id));
  }
  const est = syllables / opts.syllablesPerSec;
  const ratio = opts.maxSpeechRatio ?? 0.85;
  if (est > series.ep_length_sec * ratio)
    issues.push(warning('script.too_long', `บทพูดรวม ≈ ${est.toFixed(0)} วิ (${syllables} พยางค์ ที่ ${opts.syllablesPerSec} พยางค์/วิ) เกิน ${Math.round(ratio * 100)}% ของความยาวตอน ${series.ep_length_sec} วิ ควรตัดบท`, `ep${script.episode}`));
  if (script.lines.length === 0) issues.push(warning('script.empty', 'ไม่มีบทพูดเลย (ตอนเงียบ?)', `ep${script.episode}`));
  const timing: ScriptTiming = {
    syllables,
    est_speech_sec: Math.round(est * 10) / 10,
    ep_length_sec: series.ep_length_sec,
    per_scene: [...perScene.entries()].sort((a, b) => a[0] - b[0]).map(([scene, n]) => ({ scene, syllables: n, est_sec: Math.round((n / opts.syllablesPerSec) * 10) / 10 })),
  };
  return { report: makeReport(issues), timing };
}
