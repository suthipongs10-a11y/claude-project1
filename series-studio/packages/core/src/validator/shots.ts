import type { Bible, Continuity, Outline, Series, ShotList, Shot } from '../schemas/index.js';
import { NARRATOR_ID } from '../schemas/bible.js';
import { countSyllables } from '../text/thai.js';
import { error, makeReport, warning, type Issue, type ValidationReport } from '../util/result.js';

export interface ShotValidationContext {
  series: Pick<Series, 'ep_length_sec' | 'episodes'>;
  bible: Pick<Bible, 'characters' | 'locations'>;
  /** continuity.json; the entry for `after_episode = episode - 1` drives wardrobe checks. */
  continuity?: Continuity | undefined;
  outline?: Outline | undefined;
  /** Longest clip the engine can produce; a single shot can never exceed it. */
  maxClipSec: number;
  /** Known style preset ids (for style_override). */
  knownStyles: ReadonlySet<string>;
  /** Allowed deviation of total duration from ep_length_sec (0.05 = ±5%). */
  lengthTolerance?: number | undefined;
  /** Dialogue faster than this is flagged (syllables per second). */
  maxSyllablesPerSec?: number | undefined;
}

/** True when a shot is a neutral cutaway that resets the 180° axis. */
export function isNeutralShot(s: Shot): boolean {
  return s.type === 'INSERT' || s.characters.length === 0;
}

/** Code-only shot list validation (SPEC §8.4, CLAUDE.md rule 3). */
export function validateShots(list: ShotList, ctx: ShotValidationContext): ValidationReport {
  const issues: Issue[] = [];
  const shots = list.shots;
  const chars = new Map(ctx.bible.characters.map((c) => [c.id, c]));
  const locs = new Map(ctx.bible.locations.map((l) => [l.id, l]));
  const prevEntry = ctx.continuity?.entries.find((e) => e.after_episode === list.episode - 1);
  const tol = ctx.lengthTolerance ?? 0.05;
  const maxRate = ctx.maxSyllablesPerSec ?? 8;
  const epPrefix = `ep${String(list.episode).padStart(2, '0')}_`;

  if (list.episode > ctx.series.episodes) issues.push(error('shots.episode_out_of_range', `ตอนที่ ${list.episode} เกินจำนวนตอน (${ctx.series.episodes})`));

  // ids, order
  const seen = new Set<string>();
  let prevScene = 0;
  for (const s of shots) {
    if (seen.has(s.id)) issues.push(error('shots.duplicate_id', `shot id "${s.id}" ซ้ำ`, s.id));
    seen.add(s.id);
    if (!s.id.startsWith(epPrefix)) issues.push(warning('shots.id_prefix', `shot id ควรเริ่มด้วย "${epPrefix}" เพื่อไม่ชนกับตอนอื่น`, s.id));
    if (s.scene < prevScene) issues.push(warning('shots.scene_order', `scene ${s.scene} มาหลัง scene ${prevScene} (ลำดับย้อนกลับ)`, s.id));
    prevScene = Math.max(prevScene, s.scene);
    if (!s.purpose.trim()) issues.push(error('shots.no_purpose', 'ทุกช็อตต้องมี purpose (เหตุผลที่ช็อตนี้ต้องมี)', s.id));
    if (s.duration_sec > ctx.maxClipSec)
      issues.push(error('shots.too_long', `ช็อตยาว ${s.duration_sec} วิ เกินความยาวคลิปสูงสุดของ engine (${ctx.maxClipSec} วิ) ต้องแบ่งช็อต`, s.id));
    if (s.style_override && !ctx.knownStyles.has(s.style_override))
      issues.push(error('shots.unknown_style', `style_override "${s.style_override}" ไม่มีใน presets`, s.id));
    if (s.max_people !== undefined && s.max_people < s.characters.length)
      issues.push(warning('shots.max_people', `max_people (${s.max_people}) น้อยกว่าจำนวนตัวละครในช็อต (${s.characters.length})`, s.id));
  }

  // first = hook, last = cliffhanger
  const first = shots[0];
  const last = shots[shots.length - 1];
  if (first && first.beat !== 'hook') issues.push(error('shots.first_not_hook', 'ช็อตแรกต้องเป็นจังหวะ hook', first.id));
  if (last && last.beat !== 'cliffhanger') issues.push(error('shots.last_not_cliffhanger', 'ช็อตสุดท้ายต้องเป็นจังหวะ cliffhanger', last.id));
  if (ctx.outline) {
    const outlineTypes = new Set(ctx.outline.beats.map((b) => b.type));
    const shotTypes = new Set(shots.map((s) => s.beat));
    for (const t of outlineTypes) if (!shotTypes.has(t)) issues.push(warning('shots.beat_missing', `outline มีจังหวะ "${t}" แต่ไม่มีช็อตที่ติด beat นี้`, `ep${list.episode}`));
  }

  // 180° axis per scene
  let axisScene = -1;
  let axis: Shot['axis_side'] | null = null;
  let prevNeutral = false;
  for (const s of shots) {
    if (s.scene !== axisScene) {
      axisScene = s.scene;
      axis = null;
      prevNeutral = false;
    }
    if (isNeutralShot(s)) {
      prevNeutral = true;
      continue;
    }
    if (axis !== null && s.axis_side !== axis && !prevNeutral && !s.axis_cross_reason) {
      issues.push(
        error('shots.axis_cross', `ข้ามแกน 180° (จาก ${axis} ไป ${s.axis_side}) โดยไม่มีช็อตคั่น (INSERT/ไม่มีตัวละคร) หรือ axis_cross_reason`, s.id),
      );
    }
    axis = s.axis_side;
    prevNeutral = false;
  }

  // characters, wardrobe, continuity, locations
  const firstSeen = new Set<string>();
  for (const s of shots) {
    const loc = locs.get(s.location);
    if (!loc) issues.push(error('shots.unknown_location', `location "${s.location}" ไม่มีใน bible`, s.id));
    else if (!loc.time_variants.includes(s.time))
      issues.push(warning('shots.unknown_time', `time "${s.time}" ไม่อยู่ใน time_variants ของ ${loc.id} (${loc.time_variants.join(', ')})`, s.id));

    const inShot = new Set<string>();
    for (const sc of s.characters) {
      if (inShot.has(sc.id)) issues.push(error('shots.duplicate_character', `ตัวละคร "${sc.id}" ซ้ำในช็อตเดียว`, s.id));
      inShot.add(sc.id);
      const c = chars.get(sc.id);
      if (!c) {
        issues.push(error('shots.unknown_character', `ตัวละคร "${sc.id}" ไม่มีใน bible`, s.id));
        continue;
      }
      const known = sc.wardrobe === 'default' || sc.wardrobe in c.wardrobe_variants;
      if (!known) issues.push(warning('shots.wardrobe_freeform', `wardrobe "${sc.wardrobe}" ของ ${sc.id} ไม่ใช่ default/variant ที่ประกาศ (จะใส่ข้อความนี้ลง prompt ตรงๆ)`, s.id));
      const cont = prevEntry?.states[sc.id];
      if (cont?.wardrobe && !firstSeen.has(sc.id)) {
        if (sc.wardrobe !== cont.wardrobe) {
          issues.push(
            error(
              'shots.continuity_wardrobe',
              `ตอนที่แล้ว ${sc.id} จบด้วยชุด "${cont.wardrobe}" แต่ช็อตแรกที่เห็นในตอนนี้ใส่ "${sc.wardrobe}" (ถ้าเปลี่ยนชุดจริงให้มีช็อต/บทบอก และตั้ง wardrobe ให้ตรง หรืออัปเดต continuity)`,
              s.id,
            ),
          );
        }
      }
      firstSeen.add(sc.id);
    }

    // dialogue timing
    const cues = [...s.dialogue].sort((a, b) => a.t_start - b.t_start);
    let prevEnd = -1;
    for (const d of cues) {
      if (d.char !== NARRATOR_ID && !inShot.has(d.char)) {
        if (!chars.has(d.char)) issues.push(error('shots.dialogue_unknown_char', `บทพูดของ "${d.char}" ที่ไม่มีใน bible`, s.id));
        else issues.push(warning('shots.dialogue_offscreen', `"${d.char}" พูดแต่ไม่อยู่ในช็อต (off-screen) ตรวจว่าตั้งใจ`, s.id));
      }
      if (d.t_end <= d.t_start) issues.push(error('shots.dialogue_time', `บทพูด "${d.text}" มี t_end ≤ t_start`, s.id));
      if (d.t_end > s.duration_sec + 1e-6) issues.push(error('shots.dialogue_overflow', `บทพูด "${d.text}" จบที่ ${d.t_end} วิ เกินความยาวช็อต ${s.duration_sec} วิ`, s.id));
      if (d.t_start < prevEnd - 1e-6) issues.push(error('shots.dialogue_overlap', `บทพูด "${d.text}" ซ้อนเวลากับบทก่อนหน้า`, s.id));
      prevEnd = Math.max(prevEnd, d.t_end);
      const dur = d.t_end - d.t_start;
      if (dur > 0) {
        const rate = countSyllables(d.text) / dur;
        if (rate > maxRate) issues.push(warning('shots.dialogue_too_fast', `บทพูด "${d.text}" ≈ ${rate.toFixed(1)} พยางค์/วิ เร็วเกิน (เกิน ${maxRate})`, s.id));
      }
    }
  }

  // total duration
  const total = shots.reduce((sum, s) => sum + s.duration_sec, 0);
  const diff = Math.abs(total - ctx.series.ep_length_sec) / ctx.series.ep_length_sec;
  if (diff > tol)
    issues.push(
      error('shots.total_duration', `เวลารวม ${total.toFixed(1)} วิ ต่างจากความยาวตอน ${ctx.series.ep_length_sec} วิ เกิน ${Math.round(tol * 100)}%`, `ep${list.episode}`),
    );

  return makeReport(issues);
}
