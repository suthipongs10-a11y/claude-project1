/**
 * tts-gemini.mjs — ผู้ให้บริการเสียงตัวที่สาม: Gemini API (AI Studio)
 *
 * ทำไมต้องมี: คีย์จาก AI Studio ถูกล็อกไว้ที่ generativelanguage.googleapis.com
 * ยิง Cloud TTS (texttospeech.googleapis.com) ไม่ได้ — ได้ 403 "API ... are blocked"
 * แต่ยิงโมเดล TTS ของ Gemini เองได้ ใช้คีย์เดิมได้เลย ไม่ต้องเปิดโปรเจกต์ GCP
 *
 * ข้อแลกเปลี่ยน: Gemini **ไม่คืน timestamp** ทั้งรายตัวอักษรและรายคำ
 *   - ขอบ "บรรทัด" ยังเป๊ะ 100% เพราะวัดความยาวจากจำนวนไบต์ PCM จริง
 *   - ขอบ "คำ" ได้จากการกระจายตามน้ำหนักพยางค์ (นับเฉพาะอักขระที่กินที่)
 *     → ปากขยับตรงระดับวลี ไม่เป๊ะระดับคำเท่า ElevenLabs / Cloud TTS
 * ถ้าต้องการ lip-sync ระดับคำจริง ๆ ให้ใช้ provider "google" กับคีย์ที่เปิด Cloud TTS
 *
 * เสียงที่ได้เป็น PCM ดิบ (audio/L16 24kHz mono) — ห่อ header WAV เองแล้วเก็บเป็น .wav
 * ทำให้ downstream ใช้เส้นเดียวกับ provider "google" ทุกประการ
 */
import { segmentThai } from "./align.mjs";
import { toCharAlignment } from "./tts-google.mjs";

const BASE = "https://generativelanguage.googleapis.com/v1beta";
export const SAMPLE_RATE = 24000;
// 3.1 นิ่งกว่ามาก — 2.5-flash-preview-tts คืน finishReason=OTHER ซ้ำ ๆ กับข้อความไทยบางประโยค
export const DEFAULT_MODEL = "gemini-3.1-flash-tts-preview";
export const FALLBACK_MODELS = ["gemini-2.5-pro-preview-tts", "gemini-2.5-flash-preview-tts"];

/** อักขระไทยที่ซ้อนบน/ล่าง ไม่กินความกว้างและแทบไม่กินเวลาพูด */
const COMBINING = /[ัิ-ฺ็-๎]/u;

/** น้ำหนักเวลาโดยประมาณของหนึ่งคำ = จำนวนอักขระที่กินที่ (อย่างน้อย 1) */
export function weightOf(word) {
  let n = 0;
  for (const ch of word) if (!COMBINING.test(ch)) n++;
  return Math.max(1, n);
}

/** ห่อ PCM 16-bit mono เป็นไฟล์ WAV */
export function pcmToWav(pcm, sampleRate = SAMPLE_RATE) {
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + pcm.length, 4);
  head.write("WAVE", 8);
  head.write("fmt ", 12);
  head.writeUInt32LE(16, 16);          // ขนาด fmt chunk
  head.writeUInt16LE(1, 20);           // PCM
  head.writeUInt16LE(1, 22);           // mono
  head.writeUInt32LE(sampleRate, 24);
  head.writeUInt32LE(sampleRate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([head, pcm]);
}

/**
 * ตัดความเงียบหัว-ท้ายออก เหลือ padding เล็กน้อย
 * จำเป็นเพราะโมเดลมักใส่ความเงียบนำหน้าไม่เท่ากันทุกบรรทัด
 * ถ้าไม่ตัด บรรทัดจะเริ่มพูดช้ากว่าเวลาที่ cues.json บอก = ปากขยับก่อนได้ยินเสียง
 */
export function trimSilence(pcm, { threshold = 320, padMs = 30, sampleRate = SAMPLE_RATE } = {}) {
  const n = Math.floor(pcm.length / 2);
  let first = 0, last = n - 1;
  while (first < n && Math.abs(pcm.readInt16LE(first * 2)) < threshold) first++;
  while (last > first && Math.abs(pcm.readInt16LE(last * 2)) < threshold) last--;
  if (first >= last) return pcm;                       // เงียบทั้งไฟล์ — คืนของเดิม
  const pad = Math.round((padMs / 1000) * sampleRate);
  const a = Math.max(0, first - pad);
  const b = Math.min(n, last + 1 + pad);
  return pcm.subarray(a * 2, b * 2);
}

/**
 * สร้าง alignment รายตัวอักษรจาก "ความยาวรวม" อย่างเดียว
 * กระจายเวลาให้แต่ละคำตามน้ำหนักพยางค์ + เผื่อเวลาหยุดตรงเว้นวรรค
 * แล้วส่งต่อให้ toCharAlignment ตัวเดียวกับ provider google → downstream ไม่ต้องรู้ว่ามาจากไหน
 */
export function spreadAlignment(text, duration, { spacePause = 0.12 } = {}) {
  const toks = segmentThai(text);
  if (!toks.length) {
    const chars = Array.from(text);
    return { characters: chars, character_start_times_seconds: chars.map(() => 0), character_end_times_seconds: chars.map(() => duration) };
  }
  const w = toks.map((t) => weightOf(t.w));
  const pauses = toks.map((t) => (t.sp ? spacePause : 0));
  const totalPause = Math.min(duration * 0.35, pauses.reduce((a, b) => a + b, 0));
  const scale = totalPause > 0 ? totalPause / pauses.reduce((a, b) => a + b, 0) : 0;
  const speech = Math.max(0.05, duration - totalPause);
  const wSum = w.reduce((a, b) => a + b, 0);

  const markAt = {};
  let t = 0;
  toks.forEach((_, i) => {
    markAt[`w${i}`] = +t.toFixed(4);
    t += (w[i] / wSum) * speech + pauses[i] * scale;
  });
  markAt.wEND = +Math.min(duration, t).toFixed(4);
  return toCharAlignment(text, toks, markAt, duration);
}

/**
 * ยิง Gemini TTS หนึ่งบรรทัด
 * คืน { audio: Buffer(WAV), alignment, duration }
 */
export async function synth(text, { apiKey, voiceName = "Charon", model = DEFAULT_MODEL, styleHint = "", tries = 3 }) {
  const prompt = styleHint ? `${styleHint}: ${text}` : text;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
  };

  // โมเดลตอบว่างเป็นครั้งคราว (finishReason อื่นที่ไม่ใช่ STOP) — ลองซ้ำก่อนยอมแพ้
  // ห้าม retry ตอนโควตาหมด เพราะต้องปล่อยให้ keys.mjs สลับคีย์แทน
  const chain = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
  let part, why = "", used = model;
  for (const m of chain) {
   for (let attempt = 1; attempt <= tries; attempt++) {
    used = m;
    const res = await fetch(`${BASE}/models/${m}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Gemini TTS ${res.status}: ${t.slice(0, 300)}`);
    }
    const j = await res.json();
    const cand = j?.candidates?.[0];
    part = cand?.content?.parts?.find((p) => p.inlineData);
    if (part) break;
    why = `${m}: finishReason=${cand?.finishReason || "?"} block=${j?.promptFeedback?.blockReason || "-"}`;
    if (attempt < tries) await new Promise((r) => setTimeout(r, 800 * attempt));
   }
   if (part) break;
  }
  if (!part) throw new Error(`Gemini TTS ไม่ได้เสียงกลับมาหลังลองทุกโมเดล (${why})`);

  const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || "")?.[1]) || SAMPLE_RATE;
  const pcm = trimSilence(Buffer.from(part.inlineData.data, "base64"), { sampleRate: rate });
  const duration = pcm.length / (rate * 2);          // วัดจากไบต์จริง ไม่ใช่เดา
  return {
    audio: pcmToWav(pcm, rate),
    alignment: spreadAlignment(text, duration),
    duration,
    sampleRate: rate,
    model: used,
  };
}

/** รายชื่อเสียง prebuilt ของ Gemini TTS (ฝังไว้ — API ไม่มี endpoint ให้ list) */
export const VOICES = [
  "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede",
  "Callirrhoe", "Autonoe", "Enceladus", "Iapetus", "Umbriel", "Algieba",
  "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
  "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi",
  "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat",
];
