/**
 * keycheck.mjs — เช็คสถานะคีย์ทุกตัวใน env ว่าใช้กับอะไรได้บ้าง
 *
 *   node pipeline/keycheck.mjs
 *
 * ยิงแค่ endpoint ที่ "อ่านอย่างเดียว" ไม่เสียโควตาสังเคราะห์เสียง
 * ไม่พิมพ์ค่าคีย์ออกมา (กฎข้อ 6) — แสดงแค่ 6 ตัวหน้า/4 ตัวท้าย
 */
import fs from "node:fs";
import { readKeys, mask } from "./keys.mjs";

function loadEnv(file = ".env") {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim(), v = line.slice(i + 1).trim();
    if (v && !process.env[k]) process.env[k] = v;
  }
}

async function probe(url) {
  try {
    const r = await fetch(url);
    return { status: r.status, body: await r.text() };
  } catch (e) { return { status: 0, body: `NETWORK: ${e.message}` }; }
}

function why(body) {
  try {
    const e = JSON.parse(body).error || {};
    return `${e.status || ""} — ${String(e.message || "").split("\n")[0]}`.slice(0, 160);
  } catch { return body.slice(0, 120).replace(/\s+/g, " "); }
}

export async function check() {
  loadEnv();
  const keys = readKeys("GOOGLE_TTS_API_KEY", "GEMINI_API_KEY");
  const eleven = readKeys("ELEVENLABS_API_KEY");

  console.log(`คีย์ Google/Gemini ที่เจอ: ${keys.length} ตัว · ElevenLabs: ${eleven.length} ตัว\n`);
  const usable = [];

  for (const [i, k] of keys.entries()) {
    console.log(`key#${i + 1}  ${mask(k)}`);

    const g = await probe(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(k)}`);
    if (g.status === 200) {
      const models = (JSON.parse(g.body).models || []);
      const tts = models.filter((m) => /tts/i.test(m.name)).length;
      console.log(`  Gemini API      ✅ 200 — โมเดล ${models.length} ตัว (TTS ${tts} ตัว) → provider "gemini" ใช้ได้`);
      usable.push({ key: k, gemini: true });
    } else {
      console.log(`  Gemini API      ❌ ${g.status} — ${why(g.body)}`);
    }

    const t = await probe(`https://texttospeech.googleapis.com/v1beta1/voices?languageCode=th-TH&key=${encodeURIComponent(k)}`);
    if (t.status === 200) {
      const vs = (JSON.parse(t.body).voices || []);
      const ssml = vs.filter((v) => !/chirp/i.test(v.name));
      console.log(`  Cloud TTS       ✅ 200 — เสียงไทย ${vs.length} (รองรับ SSML ${ssml.length}) → provider "google" ใช้ได้`);
    } else {
      console.log(`  Cloud TTS       ❌ ${t.status} — ${why(t.body)}`);
    }
    console.log();
  }

  for (const [i, k] of eleven.entries()) {
    const r = await probe(`https://api.elevenlabs.io/v1/user/subscription`);
    console.log(`eleven#${i + 1}  ${mask(k)}  →  ${r.status === 0 ? r.body.slice(0, 80) : `HTTP ${r.status}`}`);
  }

  console.log(usable.length
    ? `สรุป: ใช้ provider "gemini" ได้ ${usable.length} คีย์`
    : `สรุป: ยังไม่มีคีย์ที่ใช้ได้`);
  return usable.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  check().catch((e) => { console.error("✗", e.message); process.exit(1); });
}
