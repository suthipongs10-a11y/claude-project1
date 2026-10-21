import type { Batch, DialogueMode, Shot, Voices } from '../schemas/index.js';
import { NARRATOR_ID } from '../schemas/bible.js';
import { error, makeReport, type Issue, type ValidationReport } from '../util/result.js';

export interface DubCue {
  index: number;
  shot_id: string;
  batch_id: string;
  /** Character whose line this is. */
  char: string;
  /** Voice used to speak it (NARRATOR in narration mode). */
  speaker: string;
  voice_id: string;
  lang: string;
  text: string;
  /** Seconds from the start of the first clip (content start, no title card). */
  start_sec: number;
  end_sec: number;
}

/**
 * Deterministic dub plan: every dialogue cue positioned on the content timeline with the voice
 * that will speak it. dub -> each character's own voice; narration -> the NARRATOR voice reads
 * everything. Returns errors for characters without a voice (nothing is synthesized then).
 */
export function planDubCues(
  shots: readonly Shot[],
  batches: readonly Pick<Batch, 'id' | 'shot_ids' | 'total_sec'>[],
  mode: DialogueMode,
  voices: Voices,
  defaultLang = 'th',
): { cues: DubCue[]; report: ValidationReport; content_sec: number } {
  const issues: Issue[] = [];
  const cues: DubCue[] = [];
  if (mode !== 'dub' && mode !== 'narration') {
    issues.push(error('dub.mode', `dialogue_mode "${mode}" ไม่ต้องทำเสียงพากย์ (ใช้เสียงจากโมเดล)`));
    return { cues, report: makeReport(issues), content_sec: 0 };
  }
  const ordered = [...batches].sort((a, b) => a.id.localeCompare(b.id));
  let t = 0;
  const missing = new Set<string>();
  for (const b of ordered) {
    let off = 0;
    for (const sid of b.shot_ids) {
      const shot = shots.find((s) => s.id === sid);
      if (!shot) continue;
      for (const d of shot.dialogue) {
        const speaker = mode === 'narration' ? NARRATOR_ID : d.char;
        const v = voices[speaker];
        if (!v) {
          missing.add(speaker);
        } else {
          cues.push({
            index: cues.length + 1,
            shot_id: sid,
            batch_id: b.id,
            char: d.char,
            speaker,
            voice_id: v.voice_id,
            lang: v.lang ?? defaultLang,
            text: d.text,
            start_sec: round3(t + off + d.t_start),
            end_sec: round3(t + off + d.t_end),
          });
        }
      }
      off += shot.duration_sec;
    }
    t += b.total_sec;
  }
  for (const m of missing) {
    issues.push(error('dub.no_voice', m === NARRATOR_ID ? 'ยังไม่ได้กำหนดเสียงผู้บรรยาย (voices.NARRATOR) ใช้ assign_voice' : `ตัวละคร "${m}" ยังไม่มีเสียงใน voices.json ใช้ assign_voice`, m));
  }
  return { cues, report: makeReport(issues), content_sec: round3(t) };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
