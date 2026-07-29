#!/usr/bin/env node
/**
 * frames.mjs — เรนเดอร์เฟรมตัวแทนของทุก beat เป็น PNG แล้วเปิดดูด้วยตาจริง ๆ
 *
 *   node verify/frames.mjs [--browser <path>]
 *
 * บั๊กอนิเมชั่นส่วนใหญ่ไม่ throw error มันแค่วาดผิดตำแหน่งเงียบ ๆ
 * ตัวนี้เลยเลือกเฟรม "กลาง beat" ของทุก beat มาให้ดู + สแกน NaN ใน cues
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const cues = JSON.parse(fs.readFileSync("out/cues.json", "utf8"));
const i = process.argv.indexOf("--browser");
const browser = i > 0 ? process.argv[i + 1] : process.env.REMOTION_BROWSER;

// ── สแกน NaN / undefined ที่ไม่มีทางเห็นจากภาพนิ่ง ──
const bad = [];
(function walk(o, p) {
  for (const k in o) {
    const v = o[k], q = `${p}.${k}`;
    if (typeof v === "number" && !Number.isFinite(v)) bad.push(`${q} = ${v}`);
    else if (v && typeof v === "object") walk(v, q);
  }
})(cues, "cues");
if (bad.length) {
  console.log("✗ เจอค่าที่ไม่ใช่ตัวเลขใน cues.json:");
  bad.slice(0, 10).forEach((b) => console.log("   " + b));
  process.exit(1);
}
console.log("✓ ไม่มี NaN/Infinity ใน cues.json");

// ── เฟรมกลาง beat ของทุก beat ──
const picks = Object.entries(cues.beats).map(([name, [s, e]]) => ({
  name, frame: Math.round(((s + e) / 2) * cues.fps),
}));
console.log(`เรนเดอร์ ${picks.length} เฟรมตัวแทน (กลางแต่ละ beat):`);
for (const p of picks) {
  const out = `out/qc_${String(p.frame).padStart(4, "0")}_${p.name}.png`;
  const args = ["remotion", "still", "Scene", out, `--frame=${p.frame}`];
  if (browser) args.push(`--browser-executable=${browser}`);
  execFileSync("npx", args, { stdio: "pipe" });
  console.log(`  ${p.name.padEnd(16)} เฟรม ${String(p.frame).padStart(4)} → ${out}`);
}
console.log("\n⚠ ขั้นสุดท้ายต้องเปิดดู PNG ด้วยตา — สคริปต์ยืนยันแทนไม่ได้ว่าของอยู่ถูกที่");
