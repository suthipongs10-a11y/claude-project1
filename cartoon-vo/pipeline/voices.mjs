#!/usr/bin/env node
/** voices.mjs — ดูรายชื่อเสียงไทยที่ Google TTS มีให้เลือก (ต้องมี GOOGLE_TTS_API_KEY) */
import fs from "node:fs";
import { listVoices } from "./tts-google.mjs";

if (fs.existsSync(".env")) {
  for (const raw of fs.readFileSync(".env", "utf8").split("\n")) {
    const l = raw.trim(); if (!l || l.startsWith("#")) return;
    const i = l.indexOf("="); if (i < 0) continue;
    const k = l.slice(0, i).trim(); if (!process.env[k]) process.env[k] = l.slice(i + 1).trim();
  }
}
const key = process.env.GOOGLE_TTS_API_KEY;
if (!key) { console.error("✗ ไม่มี GOOGLE_TTS_API_KEY"); process.exit(1); }
const lang = process.argv[2] || "th-TH";
const vs = await listVoices(key, lang);
console.log(`เสียง ${lang} ทั้งหมด ${vs.length} ตัว:`);
for (const v of vs) {
  const ssml = /Chirp/i.test(v.name) ? "✗ ไม่รองรับ SSML (ใช้กับ pipeline นี้ไม่ได้)" : "✓ ใช้ได้";
  console.log(`  ${v.name.padEnd(28)} ${String(v.gender).padEnd(8)} ${ssml}`);
}
