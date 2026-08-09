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

/**
 * วัดความยาวไฟล์เสียงจริง
 * WAV อ่าน header เองได้ (เป๊ะกว่าและไม่ต้องมีเครื่องมือนอก)
 * ฟอร์แมตอื่นค่อยพึ่ง ffprobe — ไม่มีก็คืน null
 */
export function probeDuration(file) {
  if (!fs.existsSync(file)) return null;
  if (file.endsWith(".wav")) {
    const d = wavInfo(fs.readFileSync(file));
    if (d) return d.dataBytes / (d.sampleRate * d.channels * (d.bits / 8));
  }
  const ffprobe = which("ffprobe");
  if (!ffprobe) return null;
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
      audio = built.file.replace(/^public\//, "");   // staticFile() อ้างจากราก public/
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
    source: segs[0]?.source || (mode === "estimate" ? "estimated" : mode),
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

/**
 * อ่าน header WAV → { sampleRate, channels, bits, dataOffset, dataBytes }
 * เดินทีละ chunk เพราะบางไฟล์มี LIST/fact คั่นก่อน data
 */
export function wavInfo(buf) {
  if (buf.length < 12 || buf.toString("ascii", 0, 4) !== "RIFF") return null;
  let pos = 12, fmt = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === "fmt ") {
      fmt = { channels: buf.readUInt16LE(body + 2), sampleRate: buf.readUInt32LE(body + 4), bits: buf.readUInt16LE(body + 14) };
    } else if (id === "data" && fmt) {
      return { ...fmt, dataOffset: body, dataBytes: Math.min(size, buf.length - body) };
    }
    pos = body + size + (size % 2);
  }
  return null;
}

/**
 * ต่อเสียงเป็นไฟล์เดียวโดยไม่ง้อ ffmpeg — ใช้ได้เมื่อทุกท่อนเป็น WAV PCM 16-bit
 * เขียนตัวอย่างลงบัฟเฟอร์เงียบตรงตำแหน่งวินาทีของแต่ละบรรทัดเป๊ะ ๆ
 * (แม่นกว่า adelay ของ ffmpeg เพราะปัดที่ระดับ sample ไม่ใช่ระดับ ms)
 */
function mixWav(lines, byId, duration) {
  const parts = [];
  for (const L of lines) {
    const buf = fs.readFileSync(byId[L.id].audioFile);
    const info = wavInfo(buf);
    if (!info || info.bits !== 16 || info.channels !== 1) return null;
    parts.push({ L, buf, info });
  }
  const rate = parts[0].info.sampleRate;
  if (parts.some((p) => p.info.sampleRate !== rate)) return null;

  const total = Math.ceil(duration * rate);
  const out = Buffer.alloc(total * 2);                 // ศูนย์ = เงียบ
  for (const { L, buf, info } of parts) {
    const at = Math.round(L.s * rate) * 2;
    const n = Math.min(info.dataBytes, out.length - at);
    if (n > 0) buf.copy(out, at, info.dataOffset, info.dataOffset + n);
  }
  const head = Buffer.alloc(44);
  head.write("RIFF", 0); head.writeUInt32LE(36 + out.length, 4); head.write("WAVE", 8);
  head.write("fmt ", 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22); head.writeUInt32LE(rate, 24); head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
  head.write("data", 36); head.writeUInt32LE(out.length, 40);

  const file = "public/vo.wav";        // ต้องอยู่ใน public/ เพราะ Scene.tsx ใช้ staticFile()
  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync(file, Buffer.concat([head, out]));
  console.log(`ต่อเสียงเป็น ${file} (ผสมเองใน Node ไม่ใช้ ffmpeg · ${rate}Hz)`);
  return { file };
}

/** ต่อเสียงทีละบรรทัดพร้อม silence padding ให้ตรง startAt */
function concatAudio(lines, segs, duration) {
  const byId = Object.fromEntries(segs.map((s) => [s.id, s]));
  if (lines.every((L) => byId[L.id].audioFile.endsWith(".wav"))) {
    const mixed = mixWav(lines, byId, duration);
    if (mixed) return mixed;
    console.log("⚠ WAV ไม่เข้าเงื่อนไขผสมเอง (ต้อง PCM 16-bit mono อัตราเดียวกัน) — ลอง ffmpeg แทน");
  }
  const ffmpeg = which("ffmpeg") || process.env.FFMPEG_BIN;
  if (!ffmpeg || !fs.existsSync(ffmpeg)) {
    console.log("⚠ ไม่พบ ffmpeg — ข้ามการต่อ vo.mp3 (ตั้ง FFMPEG_BIN ชี้ไบนารีได้)");
    return null;
  }
  const inputs = [], filters = [];
  lines.forEach((L, i) => {
    inputs.push("-i", byId[L.id].audioFile);
    filters.push(`[${i}:a]adelay=${Math.round(L.s * 1000)}|${Math.round(L.s * 1000)}[a${i}]`);
  });
  const mix = lines.map((_, i) => `[a${i}]`).join("");
  const graph = `${filters.join(";")};${mix}amix=inputs=${lines.length}:normalize=0[out]`;
  const file = "public/vo.mp3";
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
