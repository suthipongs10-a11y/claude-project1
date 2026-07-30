/**
 * tts-google.mjs — ผู้ให้บริการเสียงทางเลือก: Google Cloud Text-to-Speech
 *
 * ทำไมต้องมี: ElevenLabs หมดเครดิต แต่ pipeline ต้องมี timestamp รายคำ ไม่งั้นปากกับคำไม่ตรง
 *
 * Google ไม่คืน character timestamps เหมือน ElevenLabs — แต่คืน "timepoint" ของแท็ก
 * <mark> ใน SSML ได้ (endpoint v1beta1 + enableTimePointing: ["SSML_MARK"])
 * เราจึงแทรก <mark> ไว้หน้าทุกคำที่ตัดด้วย Intl.Segmenter → ได้เวลาเริ่มของทุกคำ
 * เวลาจบของคำ = เวลาเริ่มของคำถัดไป (คำต่อกันสนิทอยู่แล้ว) ตัวสุดท้าย = ความยาวไฟล์
 *
 * ต้องตัดคำด้วย segmentThai ตัวเดียวกับ align.mjs เป๊ะ ๆ ไม่งั้นขอบคำจะไม่ตรงกัน
 * แล้วแปลงกลับเป็น alignment แบบตัวอักษร (interpolate ในแต่ละคำ)
 * → downstream (align.mjs / cues.mjs) ใช้โค้ดเส้นเดียวกับ ElevenLabs ไม่ต้องแก้อะไร
 *
 * ขอ LINEAR16 (WAV) มา เพราะคำนวณความยาวจากจำนวนไบต์ได้เป๊ะ ไม่ต้องพึ่ง ffprobe
 * (CLAUDE.md ห้ามเชื่อ timestamp ตัวท้ายว่าเป็นความยาวไฟล์ — อันนี้วัดจากไบต์จริง)
 */
import { segmentThai } from "./align.mjs";

const BASE = "https://texttospeech.googleapis.com/v1beta1";
const SAMPLE_RATE = 24000;

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/**
 * สร้าง SSML ที่มี <mark> คั่นหน้าทุกคำ + ปิดท้ายอีกหนึ่งอันเพื่อรู้เวลาจบคำสุดท้าย
 * คืน { ssml, toks }
 */
export function buildSSML(text) {
  const toks = segmentThai(text);
  let out = "";
  let cursor = 0;
  toks.forEach((t, i) => {
    out += esc(text.slice(cursor, t.from));      // ช่องว่าง/อักขระคั่นที่อยู่ก่อนคำนี้
    out += `<mark name="w${i}"/>` + esc(t.w);
    cursor = t.to;
  });
  out += esc(text.slice(cursor));
  out += `<mark name="wEND"/>`;
  return { ssml: `<speak>${out}</speak>`, toks };
}

/** ความยาวจริงจากไบต์ของ WAV (LINEAR16 mono 16-bit) — เป๊ะ ไม่ต้องใช้ ffprobe */
export function wavDuration(buf, sampleRate = SAMPLE_RATE) {
  const HEADER = 44;
  const bytes = Math.max(0, buf.length - HEADER);
  return bytes / (sampleRate * 2);
}

/**
 * แปลง timepoint ของคำ → alignment แบบตัวอักษร (รูปแบบเดียวกับ ElevenLabs)
 * เกลี่ยเวลาเชิงเส้นภายในแต่ละคำ ขอบคำจึงตรงกับ mark เป๊ะเมื่อ align.mjs ตัดคำซ้ำ
 */
export function toCharAlignment(text, toks, markAt, duration) {
  const chars = Array.from(text);
  const cs = new Array(chars.length).fill(0);
  const ce = new Array(chars.length).fill(0);

  const startOf = (i) => markAt[`w${i}`] ?? 0;
  const endOf = (i) => (i + 1 < toks.length ? startOf(i + 1) : (markAt.wEND ?? duration));

  let prevEnd = 0;
  toks.forEach((t, i) => {
    const s = startOf(i);
    const e = Math.max(s + 0.01, endOf(i));
    const n = Math.max(1, t.to - t.from);
    // อักขระที่อยู่ "ก่อน" คำนี้ (ช่องว่าง) ยึดเวลาเดิมค้างไว้
    for (let c = Math.max(0, prevEnd === 0 ? 0 : 0); c < t.from; c++) {
      if (!cs[c] && !ce[c]) { cs[c] = prevEnd; ce[c] = prevEnd; }
    }
    for (let k = 0; k < n; k++) {
      const c = t.from + k;
      if (c >= chars.length) break;
      cs[c] = +(s + ((e - s) * k) / n).toFixed(4);
      ce[c] = +(s + ((e - s) * (k + 1)) / n).toFixed(4);
    }
    prevEnd = e;
  });
  for (let c = 0; c < chars.length; c++) {
    if (!cs[c] && !ce[c]) { cs[c] = prevEnd; ce[c] = prevEnd; }
  }
  return { characters: chars, character_start_times_seconds: cs, character_end_times_seconds: ce };
}

/**
 * ยิง Google TTS หนึ่งบรรทัด
 * คืน { audio: Buffer(WAV), alignment, duration, requests }
 */
export async function synth(text, { apiKey, voiceName, languageCode = "th-TH", speakingRate = 1.0 }) {
  const { ssml, toks } = buildSSML(text);
  const body = {
    input: { ssml },
    voice: { languageCode, name: voiceName },
    audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: SAMPLE_RATE, speakingRate },
    enableTimePointing: ["SSML_MARK"],
  };
  const res = await fetch(`${BASE}/text:synthesize?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Google TTS ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json();
  if (!j.audioContent) throw new Error("Google TTS ไม่ได้ audioContent กลับมา");
  const audio = Buffer.from(j.audioContent, "base64");
  const duration = wavDuration(audio);

  const tps = j.timepoints || [];
  if (!tps.length) {
    throw new Error(
      "Google TTS ไม่คืน timepoints — เสียงที่เลือกอาจไม่รองรับ SSML " +
      "(เสียงตระกูล Chirp/Chirp3 ไม่รองรับ) ให้ใช้ Standard / WaveNet / Neural2 แทน"
    );
  }
  const markAt = Object.fromEntries(tps.map((p) => [p.markName, p.timeSeconds ?? 0]));
  const alignment = toCharAlignment(text, toks, markAt, duration);
  return { audio, alignment, duration, marks: tps.length };
}

/** ดูว่าภาษาไทยมีเสียงอะไรให้เลือก (ใช้ตรวจก่อนตั้ง voiceName) */
export async function listVoices(apiKey, languageCode = "th-TH") {
  const res = await fetch(
    `${BASE}/voices?languageCode=${encodeURIComponent(languageCode)}&key=${encodeURIComponent(apiKey)}`
  );
  if (!res.ok) throw new Error(`voices.list ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return (j.voices || []).map((v) => ({
    name: v.name,
    gender: v.ssmlGender,
    rate: v.naturalSampleRateHertz,
  }));
}
