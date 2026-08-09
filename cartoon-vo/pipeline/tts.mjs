/**
 * tts.mjs — ยิง ElevenLabs ทีละบรรทัด เก็บ mp3 + alignment เข้า cache
 *
 *   node pipeline/tts.mjs [--script assets/script.json]
 *
 * ลำดับ:
 *   1. มี cache → ข้าม ไม่ยิง (นับ cached)
 *   2. ไม่มี cache + มีคีย์ → POST /v1/text-to-speech/{voice}/with-timestamps
 *      ไม่มี alignment กลับมา → fallback /v1/forced-alignment
 *   3. ไม่มี cache + ไม่มีคีย์ → โหมด estimate (CLAUDE.md ข้อ 3)
 *      กะเวลาจากจำนวนตัวอักษร แล้วสร้าง alignment สังเคราะห์ในรูปแบบเดียวกับของจริง
 *      → ทาง downstream (align/cues) ใช้โค้ดเส้นเดียวกันทั้งสองโหมด
 *
 * นับ network request แล้วพิมพ์ออกมาเสมอ (acceptance ของ M1)
 */
import fs from "node:fs";
import { keyOf, get, put } from "./cache.mjs";
import * as google from "./tts-google.mjs";
import * as gemini from "./tts-gemini.mjs";
import { readKeys, mask, withKeyRotation } from "./keys.mjs";

const API = "https://api.elevenlabs.io";
const CHAR_BASE = 0.09;   // ค่าคงที่ต่อบรรทัด (CLAUDE.md)
const CHAR_RATE = 0.055;  // วินาทีต่อตัวอักษร

let requests = 0;

/** โหลด .env แบบง่าย ๆ — ไม่ log ค่าคีย์ออกมาเด็ดขาด (กฎข้อ 6) */
function loadEnv(file = ".env") {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (v && !process.env[k]) process.env[k] = v;
  }
}

/** alignment สังเคราะห์: กระจายเวลาเท่า ๆ กันต่อตัวอักษร */
export function estimateAlignment(text) {
  const chars = [...text];
  const total = CHAR_BASE + chars.length * CHAR_RATE;
  const per = total / chars.length;
  const starts = chars.map((_, i) => +(i * per).toFixed(4));
  const ends = chars.map((_, i) => +((i + 1) * per).toFixed(4));
  return { characters: chars, character_start_times_seconds: starts, character_end_times_seconds: ends };
}

async function callTTS(text, voiceId, modelId, key) {
  requests++;
  const res = await fetch(`${API}/v1/text-to-speech/${voiceId}/with-timestamps`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: modelId, enable_logging: false }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const audio = Buffer.from(j.audio_base64, "base64");
  let alignment = j.alignment || j.normalized_alignment || null;
  if (!alignment) alignment = await forcedAlign(text, audio, key);
  return { audio, alignment };
}

/** สำรอง: ส่งเสียง + ข้อความเข้า forced-alignment (เขียนไว้ตั้งแต่แรกตาม CLAUDE.md) */
async function forcedAlign(text, audioBuf, key) {
  requests++;
  const fd = new FormData();
  fd.append("file", new Blob([audioBuf], { type: "audio/mpeg" }), "seg.mp3");
  fd.append("text", text);
  const res = await fetch(`${API}/v1/forced-alignment`, {
    method: "POST", headers: { "xi-api-key": key }, body: fd,
  });
  if (!res.ok) throw new Error(`forced-alignment ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const chars = j.characters || [];
  return {
    characters: chars.map(c => c.text ?? c.character),
    character_start_times_seconds: chars.map(c => c.start ?? c.start_time_seconds),
    character_end_times_seconds: chars.map(c => c.end ?? c.end_time_seconds),
  };
}

export async function run(scriptFile = "assets/script.json") {
  loadEnv();
  const script = JSON.parse(fs.readFileSync(scriptFile, "utf8"));
  const { voiceId, modelId } = script;

  // เลือกผู้ให้บริการ: ระบุใน script.json ได้ ไม่งั้นดูจากคีย์ที่มี
  // คีย์ Google/Gemini รองรับหลายตัวคั่นด้วย , — สลับอัตโนมัติเมื่อโควตาหมด
  const elevenKeys = readKeys("ELEVENLABS_API_KEY");
  const googleKeys = readKeys("GOOGLE_TTS_API_KEY", "GEMINI_API_KEY");
  const want = script.provider || (elevenKeys.length ? "elevenlabs" : googleKeys.length ? "google" : "estimate");
  const mode =
    want === "gemini" && googleKeys.length ? "gemini" :
    want === "google" && googleKeys.length ? "google" :
    want === "elevenlabs" && elevenKeys.length ? "elevenlabs" : "estimate";

  if (mode === "estimate") {
    const why = want === "elevenlabs" ? "ELEVENLABS_API_KEY" : "GOOGLE_TTS_API_KEY / GEMINI_API_KEY";
    console.log(`⚠ ไม่มี ${why} — เข้าโหมด estimate (กะเวลาจากจำนวนตัวอักษร)`);
    console.log("  จัด layout ให้จบก่อนได้ แล้วค่อยยิงเสียงจริงรอบเดียวตอนมีคีย์\n");
  } else {
    const n = mode === "elevenlabs" ? elevenKeys.length : googleKeys.length;
    console.log(`ใช้เสียงจาก: ${mode} · คีย์ ${n} ตัว (${mask((mode === "elevenlabs" ? elevenKeys : googleKeys)[0])})\n`);
  }
  const key = mode === "elevenlabs" ? elevenKeys[0] : "";

  // cache key ต้องผูกกับผู้ให้บริการ+เสียงด้วย ไม่งั้นสลับ provider แล้วหยิบของเก่าผิดตัว
  const geminiVoice = script.geminiVoice || "Charon";
  const geminiModel = script.geminiModel || gemini.DEFAULT_MODEL;
  const voiceTag =
    mode === "gemini" ? `gemini:${geminiVoice}` :
    mode === "google" ? `google:${script.googleVoice || ""}` : voiceId;
  const modelTag =
    mode === "gemini" ? geminiModel :
    mode === "google" ? "gcloud-tts" : modelId;

  let cached = 0, fresh = 0;
  const segs = [];
  for (const line of script.lines) {
    const k = keyOf(line.text, voiceTag, modelTag);
    const hit = get(k);
    if (hit) {
      cached++;
      console.log(`  ${line.id}  cached   ${k.slice(0, 8)}  [${hit.source}]`);
      segs.push({ id: line.id, key: k, ...hit });
      continue;
    }
    let meta, audio = null;
    if (mode === "gemini") {
      const r = await withKeyRotation(googleKeys, (apiKey) => {
        requests++;
        return gemini.synth(line.text, {
          apiKey, voiceName: geminiVoice, model: geminiModel,
          styleHint: script.geminiStyle || "",
        });
      }, console.log);
      audio = r.audio;
      meta = { text: line.text, voiceId: voiceTag, modelId: modelTag,
               source: `gemini:${geminiVoice}`, alignment: r.alignment,
               duration: +r.duration.toFixed(4), audioFormat: "wav",
               sampleRate: r.sampleRate, wordTiming: "spread" };
    } else if (mode === "google") {
      const r = await withKeyRotation(googleKeys, (apiKey) => {
        requests++;
        return google.synth(line.text, {
          apiKey,
          voiceName: script.googleVoice,
          languageCode: script.languageCode || "th-TH",
          speakingRate: script.speakingRate || 1.0,
        });
      }, console.log);
      audio = r.audio;
      meta = { text: line.text, voiceId: voiceTag, modelId: modelTag,
               source: `google:${script.googleVoice}`, alignment: r.alignment,
               duration: +r.duration.toFixed(4), audioFormat: "wav",
               sampleRate: 24000, wordTiming: "ssml-mark" };
    } else if (key) {
      const r = await callTTS(line.text, voiceId, modelId, key);
      audio = r.audio;
      meta = { text: line.text, voiceId, modelId, source: `elevenlabs:${modelId}`, alignment: r.alignment };
    } else {
      meta = { text: line.text, voiceId: voiceTag, modelId: modelTag, source: "estimated", alignment: estimateAlignment(line.text) };
    }
    const saved = put(k, meta, audio);
    fresh++;
    console.log(`  ${line.id}  ${mode === "estimate" ? "estimate" : "fetched "} ${k.slice(0, 8)}  [${saved.source}]`);
    segs.push({ id: line.id, key: k, ...saved });
  }

  console.log(`\nสรุป: cached ${cached} · ใหม่ ${fresh} · network request = ${requests}`);
  fs.mkdirSync("out", { recursive: true });
  fs.writeFileSync("out/segments.json", JSON.stringify({ mode, voiceId, modelId, segs }, null, 1), "utf8");
  console.log(`เขียน out/segments.json (${segs.length} บรรทัด · โหมด ${mode})`);
  return { requests, cached, fresh, mode };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf("--script");
  run(i > 0 ? process.argv[i + 1] : undefined).catch(e => {
    console.error("✗", e.message);
    process.exit(1);
  });
}
