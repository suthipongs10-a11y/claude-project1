/**
 * cues.mjs — ประกอบทุกอย่างเป็น cues.json (single source of truth)
 *
 *   node pipeline/cues.mjs [--fps 30]
 *
 * - วางบรรทัดบนไทม์ไลน์: startAt ถ้าปักหมุดไว้ ไม่งั้นต่อจากบรรทัดก่อน + gapAfter
 * - คำได้เวลาจาก align.mjs แล้วเลื่อนให้คำแรกเริ่มพร้อมบรรทัดเป๊ะ
 * - beats: start ตรง ๆ หรือ anchorLine + offset → แล้วปิดท้ายให้ต่อกันสนิท
 * - mouth: ช่วงของทุกคำที่ออกเสียง (ปากเปิด)
 * - มีเสียงจริง → ต่อเป็น vo.mp3 ด้วย ffmpeg concat แล้ววัดยาวด้วย ffprobe
 *   (ห้ามเชื่อ timestamp ตัวสุดท้ายว่าเป็นความยาวไฟล์ — CLAUDE.md)
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { mapCharsToWords, shiftWords } from "./align.mjs";

const EPS = 0.02;

function which(bin) {
  try { return execFileSync("which", [bin], { encoding: "utf8" }).trim() || null; }
  catch { return null; }
}

/** วัดความยาวไฟล์เสียงจริง — คืน null ถ้าไม่มี ffprobe */
export function probeDuration(file) {
  const ffprobe = which("ffprobe");
  if (!ffprobe || !fs.existsSync(file)) return null;
  const out = execFileSync(ffprobe, [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1", file,
  ], { encoding: "utf8" });
  const d = parseFloat(out.trim());
  return Number.isFinite(d) ? d : null;
}

export function build(scriptFile = "assets/script.json", segFile = "out/segments.json", fps = 30) {
  const script = JSON.parse(fs.readFileSync(scriptFile, "utf8"));
  const { segs, mode } = JSON.parse(fs.readFileSync(segFile, "utf8"));
  const byId = Object.fromEntries(segs.map((s) => [s.id, s]));

  // ── วางบรรทัดบนไทม์ไลน์ ──
  const lines = [];
  let cursor = 0;
  for (const L of script.lines) {
    const seg = byId[L.id];
    if (!seg) throw new Error(`ไม่พบ segment ของบรรทัด ${L.id} — รัน tts.mjs ก่อน`);
    const start = L.startAt != null ? L.startAt : cursor;
    let words = mapCharsToWords(L.text, seg.alignment);
    if (!words.length) throw new Error(`${L.id}: ตัดคำแล้วไม่ได้อะไรเลย`);

    // คำแรกต้องเริ่มพร้อมบรรทัดเป๊ะ (verify บังคับ)
    const lead = words[0].s;
    words = shiftWords(words.map((w) => ({ ...w, s: w.s - lead, e: w.e - lead })), start);

    const e = words[words.length - 1].e;
    lines.push({ id: L.id, style: L.style || "calm", s: +start.toFixed(4), e: +e.toFixed(4), hold: L.hold || 0, words });
    cursor = +(e + (L.gapAfter || 0)).toFixed(4);
  }

  const last = lines[lines.length - 1];
  let duration = +(last.e + last.hold + (script.tailOut || 0)).toFixed(4);

  // ── เสียงจริง: ต่อไฟล์ + วัดยาวจริง ──
  let audio;
  const haveAudio = segs.every((s) => s.audioFile && fs.existsSync(s.audioFile));
  if (haveAudio) {
    const built = concatAudio(lines, segs, duration);
    if (built) {
      audio = built.file;
      const real = probeDuration(built.file);
      if (real != null) duration = +Math.max(duration, real).toFixed(4);
      else console.log("⚠ ไม่มี ffprobe — ใช้ความยาวจากไทม์ไลน์แทน (ควรวัดจริงก่อนเรนเดอร์)");
    }
  } else {
    console.log(`⚠ ยังไม่มีไฟล์เสียง (โหมด ${mode}) — ข้ามการต่อ vo.mp3 และการวัดด้วย ffprobe`);
  }

  // ── beats: ต่อกันสนิท ไม่มีรู ไม่ทับ ──
  const lineById = Object.fromEntries(lines.map((l) => [l.id, l]));
  const marks = script.beats.map((b) => {
    if (b.start != null) return { name: b.name, at: b.start };
    const L = lineById[b.anchorLine];
    if (!L) throw new Error(`beat "${b.name}": ไม่พบ anchorLine ${b.anchorLine}`);
    return { name: b.name, at: +(L.s + (b.offset || 0)).toFixed(4) };
  }).sort((a, b) => a.at - b.at);

  const beats = {};
  for (const [i, m] of marks.entries()) {
    const start = Math.max(0, m.at);
    const end = i < marks.length - 1 ? Math.max(start + EPS, marks[i + 1].at) : duration;
    beats[m.name] = [+start.toFixed(4), +end.toFixed(4)];
  }

  // ── mouth: ทุกคำที่ออกเสียง ──
  const mouth = lines.flatMap((L) => L.words.filter((w) => w.speak !== false).map((w) => [w.s, w.e]));

  const cues = {
    fps,
    duration,
    frames: Math.round(duration * fps),
    source: mode === "estimate" ? "estimated" : `elevenlabs:${script.modelId}`,
    ...(audio ? { audio } : {}),
    beats,
    mouth,
    lines: lines.map(({ hold, ...rest }) => ({ ...rest, hold })),
  };

  fs.mkdirSync("out", { recursive: true });
  fs.writeFileSync("out/cues.json", JSON.stringify(cues, null, 1), "utf8");
  const nw = lines.reduce((a, L) => a + L.words.length, 0);
  console.log(`เขียน out/cues.json — ${lines.length} บรรทัด · ${nw} คำ · ${mouth.length} ช่วงปาก · ` +
              `${Object.keys(beats).length} beats · ${cues.frames} เฟรม @ ${fps}fps · ${duration}s`);
  return cues;
}

/** ต่อ mp3 ทีละบรรทัดพร้อม silence padding ให้ตรง startAt */
function concatAudio(lines, segs, duration) {
  const ffmpeg = which("ffmpeg") || process.env.FFMPEG_BIN;
  if (!ffmpeg || !fs.existsSync(ffmpeg)) {
    console.log("⚠ ไม่พบ ffmpeg — ข้ามการต่อ vo.mp3 (ตั้ง FFMPEG_BIN ชี้ไบนารีได้)");
    return null;
  }
  const byId = Object.fromEntries(segs.map((s) => [s.id, s]));
  const inputs = [], filters = [];
  lines.forEach((L, i) => {
    inputs.push("-i", byId[L.id].audioFile);
    filters.push(`[${i}:a]adelay=${Math.round(L.s * 1000)}|${Math.round(L.s * 1000)}[a${i}]`);
  });
  const mix = lines.map((_, i) => `[a${i}]`).join("");
  const graph = `${filters.join(";")};${mix}amix=inputs=${lines.length}:normalize=0[out]`;
  const file = "out/vo.mp3";
  execFileSync(ffmpeg, ["-y", ...inputs, "-filter_complex", graph, "-map", "[out]",
    "-t", String(duration), "-c:a", "libmp3lame", "-b:a", "128k", file], { stdio: "pipe" });
  console.log(`ต่อเสียงเป็น ${file}`);
  return { file };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf("--fps");
  try {
    build(undefined, undefined, i > 0 ? Number(process.argv[i + 1]) : 30);
  } catch (e) {
    console.error("✗", e.message);
    process.exit(1);
  }
}
