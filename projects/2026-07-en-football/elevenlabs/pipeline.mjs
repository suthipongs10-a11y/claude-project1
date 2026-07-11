// ElevenLabs per-segment TTS pipeline
// ใช้: node pipeline.mjs voices        → ลิสต์เสียงที่ใช้ได้ (เลือก voice id)
//      node pipeline.mjs gen           → gen เสียงทุก segment (ข้ามไฟล์ที่มีแล้ว)
//      node pipeline.mjs gen --force   → gen ใหม่ทั้งหมดทับของเดิม
//      node pipeline.mjs timing        → ตาราง duration จาก ffprobe (ไม่ gen)
//
// ต้องมีไฟล์ .env ในโฟลเดอร์นี้:
//   ELEVENLABS_API_KEY=xi-...
//   VOICE_ID=...            (ได้จากคำสั่ง voices)

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'audio');

function loadEnv() {
  const envPath = join(here, '.env');
  if (!existsSync(envPath)) {
    console.error('ไม่พบไฟล์ .env — สร้างไฟล์ ' + envPath + ' แล้วใส่:\nELEVENLABS_API_KEY=...\nVOICE_ID=...');
    process.exit(1);
  }
  const env = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

async function listVoices(env) {
  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY },
  });
  if (!res.ok) { console.error('API error', res.status, await res.text()); process.exit(1); }
  const data = await res.json();
  for (const v of data.voices) {
    console.log(`${v.voice_id}  ${v.name}  [${(v.labels && Object.values(v.labels).join(', ')) || ''}]`);
  }
  console.log('\nแนะนำสำหรับคลิปนี้: เสียงผู้ชายโทน energetic/narration — เอา voice_id ที่เลือกใส่ .env เป็น VOICE_ID=');
}

function ffprobeDuration(file) {
  const r = spawnSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return parseFloat(r.stdout.trim());
}

async function genSegment(env, seg, defaults, force) {
  const outFile = join(outDir, seg.id + '.mp3');
  if (existsSync(outFile) && !force) { console.log(seg.id + ' มีแล้ว — ข้าม'); return outFile; }
  const body = {
    text: seg.text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: seg.stability ?? defaults.stability,
      similarity_boost: seg.similarity_boost ?? defaults.similarity_boost,
      style: seg.style ?? defaults.style,
      speed: seg.speed ?? defaults.speed,
      use_speaker_boost: true,
    },
  };
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${env.VOICE_ID}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) { console.error(`${seg.id} FAILED: ${res.status} ${await res.text()}`); return null; }
  writeFileSync(outFile, Buffer.from(await res.arrayBuffer()));
  console.log(`${seg.id} ✓  "${seg.text}"`);
  return outFile;
}

function writeTiming(config) {
  const rows = [];
  let t = 0;
  for (const seg of config.segments) {
    const f = join(outDir, seg.id + '.mp3');
    if (!existsSync(f)) { rows.push({ id: seg.id, shot: seg.shot, missing: true }); continue; }
    const d = ffprobeDuration(f);
    rows.push({ id: seg.id, shot: seg.shot, text: seg.text, duration: +d.toFixed(2), start: +t.toFixed(2) });
    t += d;
  }
  const md = ['# Timing — เสียงบรรยาย', '', '| segment | ช็อต | เริ่ม (s) | ยาว (s) | ประโยค |', '|---|---|---|---|---|',
    ...rows.map(r => r.missing ? `| ${r.id} | ${r.shot} | — | ไม่มีไฟล์ | |`
      : `| ${r.id} | ${r.shot} | ${r.start} | ${r.duration} | ${r.text} |`),
    '', `รวมเสียงบรรยาย ~${t.toFixed(1)}s (ยังไม่รวมช่วงเสียงจริงช็อต 10 และ 18)`].join('\n');
  writeFileSync(join(here, 'timing.md'), md);
  writeFileSync(join(here, 'timing.json'), JSON.stringify(rows, null, 2));
  console.log('\n' + md);
}

const mode = process.argv[2] || 'gen';
const force = process.argv.includes('--force');
const env = loadEnv();
const config = JSON.parse(readFileSync(join(here, 'segments.json'), 'utf8'));

if (mode === 'voices') {
  await listVoices(env);
} else if (mode === 'timing') {
  writeTiming(config);
} else if (mode === 'gen') {
  if (!env.VOICE_ID) { console.error('ยังไม่ได้ตั้ง VOICE_ID ใน .env — รัน: node pipeline.mjs voices'); process.exit(1); }
  mkdirSync(outDir, { recursive: true });
  for (const seg of config.segments) {
    await genSegment(env, seg, config.defaults, force);
  }
  writeTiming(config);
} else {
  console.error('ไม่รู้จักคำสั่ง: ' + mode);
}
