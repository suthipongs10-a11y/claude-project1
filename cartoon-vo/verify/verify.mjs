#!/usr/bin/env node
/**
 * verify.mjs — ตรวจ cues.json ตามสัญญาก่อนเอาไปเรนเดอร์
 *
 *   node verify/verify.mjs out/cues.json
 *
 * ตกข้อไหน exit 1 — เอาไปแขวนใน pre-commit หรือ acceptance ของ M3/M5 ได้เลย
 * บั๊กพวกนี้ไม่ throw error ตอนเรนเดอร์ มันแค่ทำให้ภาพผิดเงียบ ๆ ต้องดักเอง
 */

import fs from "node:fs";

const EPS = 0.02;
const file = process.argv[2] || "out/cues.json";
const c = JSON.parse(fs.readFileSync(file, "utf8"));

const errs = [], warns = [];
const err = m => errs.push(m);
const warn = m => warns.push(m);

/* ── โครงไฟล์ ─────────────────────────────────────────── */
for (const k of ["fps", "duration", "frames", "beats", "mouth", "lines"]) {
  if (c[k] == null) err(`ไม่มีคีย์ "${k}"`);
}
if (errs.length) { report(); process.exit(1); }

if (Math.abs(c.frames - Math.round(c.duration * c.fps)) > 1) {
  err(`frames(${c.frames}) ไม่ตรงกับ duration×fps(${Math.round(c.duration * c.fps)})`);
}
if (c.duration <= 0) err("duration ต้องมากกว่า 0");

/* ── บรรทัดและคำ ───────────────────────────────────────
   คำต้องเรียงเวลา ไม่ทับกัน และอยู่ในกรอบบรรทัดของตัวเอง
   ถ้าคำทับกัน = ไฮไลต์คาราโอเกะจะติดสองคำพร้อมกัน               */
const ids = new Set();
for (const L of c.lines) {
  const tag = `line ${L.id}`;
  if (ids.has(L.id)) err(`${tag}: id ซ้ำ`);
  ids.add(L.id);

  if (!L.words?.length) { err(`${tag}: ไม่มีคำ`); continue; }
  if (!(L.s < L.e)) err(`${tag}: s ต้องน้อยกว่า e (${L.s} → ${L.e})`);
  if (L.e > c.duration + EPS) err(`${tag}: จบที่ ${L.e} เกิน duration ${c.duration}`);

  let prev = null;
  for (const [i, w] of L.words.entries()) {
    const wt = `${tag} คำ "${w.w}"`;
    if (!(w.s < w.e)) err(`${wt}: s ต้องน้อยกว่า e (${w.s} → ${w.e})`);
    if (w.s < L.s - EPS) err(`${wt}: เริ่มก่อนบรรทัด (${w.s} < ${L.s})`);
    if (w.e > L.e + EPS) err(`${wt}: จบหลังบรรทัด (${w.e} > ${L.e})`);
    if (prev && w.s < prev.e - EPS) err(`${wt}: ทับกับคำก่อนหน้า "${prev.w}"`);
    if (prev && w.s - prev.e > 2.0) warn(`${wt}: เงียบ ${(w.s - prev.e).toFixed(2)}s ก่อนคำนี้ — alignment อาจเพี้ยน`);
    if (w.e - w.s > 2.5) warn(`${wt}: ยาว ${(w.e - w.s).toFixed(2)}s ผิดปกติสำหรับหนึ่งคำ`);
    if (w.e - w.s < 0.05) warn(`${wt}: สั้น ${(w.e - w.s).toFixed(3)}s อ่านไม่ทัน`);
    if (i === 0 && Math.abs(w.s - L.s) > EPS) err(`${wt}: คำแรกต้องเริ่มพร้อมบรรทัด`);
    prev = w;
  }
}

/* ── ปากขยับ ──────────────────────────────────────────
   ทุกช่วงปากต้องมีคำจริงรองรับ ไม่งั้นปากขยับตอนไม่มีเสียง        */
const words = c.lines.flatMap(L => L.words);
let last = -1;
for (const [s, e] of c.mouth) {
  if (!(s < e)) err(`mouth [${s},${e}]: s ต้องน้อยกว่า e`);
  if (s < last - EPS) err(`mouth [${s},${e}]: ไม่ได้เรียงเวลา`);
  if (e > c.duration + EPS) err(`mouth [${s},${e}]: เกิน duration`);
  if (!words.some(w => Math.abs(w.s - s) < EPS && Math.abs(w.e - e) < EPS)) {
    err(`mouth [${s},${e}]: ไม่มีคำไหนตรงช่วงนี้ — ปากจะขยับตอนเงียบ`);
  }
  last = e;
}
const speakable = words.filter(w => w.speak !== false).length;
if (c.mouth.length && Math.abs(c.mouth.length - speakable) > speakable * 0.2) {
  warn(`ช่วงปาก ${c.mouth.length} ช่วง แต่คำที่ออกเสียง ${speakable} คำ — ห่างกันเยอะ`);
}

/* ── จังหวะฉาก ────────────────────────────────────────
   beats ต้องต่อกันสนิท ไม่มีรู ไม่ทับ ไม่งั้นฉากจะค้างหรือกระโดด    */
const names = Object.keys(c.beats);
if (!names.length) err("ไม่มี beats");
let prevEnd = null;
for (const n of names) {
  const b = c.beats[n];
  if (!Array.isArray(b) || b.length !== 2) { err(`beat "${n}": ต้องเป็น [start, end]`); continue; }
  if (!(b[0] < b[1])) err(`beat "${n}": start ต้องน้อยกว่า end (${b[0]} → ${b[1]})`);
  if (b[1] > c.duration + EPS) err(`beat "${n}": จบที่ ${b[1]} เกิน duration`);
  if (prevEnd !== null && Math.abs(b[0] - prevEnd) > EPS) {
    err(`beat "${n}": เริ่มที่ ${b[0]} แต่ beat ก่อนหน้าจบที่ ${prevEnd} — มีรู/ทับกัน`);
  }
  prevEnd = b[1];
}
if (prevEnd !== null && Math.abs(prevEnd - c.duration) > 0.5) {
  warn(`beat สุดท้ายจบที่ ${prevEnd} แต่คลิปยาว ${c.duration} — มีช่วงท้ายที่ไม่มีฉากคุม`);
}

/* ── ทุกคำต้องเรนเดอร์ได้จริงบนกริดเฟรม ────────────────
   คำที่สั้นกว่า 1 เฟรมจะกะพริบหายตอนเรนเดอร์ ทั้งที่พรีวิวเห็น      */
for (const w of words) {
  if (Math.round(w.e * c.fps) - Math.round(w.s * c.fps) < 1) {
    err(`คำ "${w.w}" (${w.s}→${w.e}) กินไม่ถึง 1 เฟรมที่ ${c.fps}fps — จะหายตอนเรนเดอร์`);
  }
}

/* ── เสียง ────────────────────────────────────────────── */
if (!c.audio) warn("ไม่มีฟิลด์ audio — ยังไม่ได้ยิงเสียงจริงใช่ไหม");
if (c.source?.startsWith("estimated")) warn("cues นี้เป็นเวลาที่กะไว้ ยังไม่ใช่จาก TTS จริง");

report();
process.exit(errs.length ? 1 : 0);

function report() {
  const n = (c.lines || []).reduce((a, L) => a + (L.words?.length || 0), 0);
  for (const w of warns) console.log(`  ⚠  ${w}`);
  for (const e of errs)  console.log(`  ✗  ${e}`);
  if (!errs.length) {
    console.log(`✓ ผ่าน — ${c.lines.length} บรรทัด · ${n} คำ · ${c.mouth.length} ช่วงปาก · ` +
                `${Object.keys(c.beats || {}).length} beats · ${c.frames} เฟรม @ ${c.fps}fps`);
  } else {
    console.log(`\n✗ ไม่ผ่าน ${errs.length} ข้อ (เตือน ${warns.length})`);
  }
}
