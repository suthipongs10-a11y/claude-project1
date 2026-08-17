#!/usr/bin/env node
/**
 * แคปหน้าเว็บต้นทางไว้ใช้เป็นฟุตเทจ B-roll ของคลิปรีวิว
 *
 *  - full.png        ภาพเต็มหน้า (เอาไปทำ shot แบบ web_pan สกรอลล์ลง)
 *  - view-NN.png     ภาพขนาด viewport ที่ตำแหน่งสกรอลล์ต่าง ๆ (shot แบบ web_hold)
 *  - sel-<name>.png  ภาพเฉพาะ element ที่ระบุ (เช่นตารางราคา)
 *  - scroll.webm     คลิปสกรอลล์จริง (ถ้าใส่ --video)
 *
 * ใช้:
 *   NODE_PATH=/opt/node22/lib/node_modules node capture_web.mjs \
 *     --url https://example.com --out capture/example \
 *     --views 4 --sel "pricing=#pricing" --video
 */
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

/** เบราว์เซอร์ที่ติดตั้งมากับ image (Claude Code cloud) — กัน playwright ไปโหลดใหม่ */
const PREINSTALLED_CHROMIUM = '/opt/pw-browsers/chromium';
function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  if (existsSync(PREINSTALLED_CHROMIUM)) return PREINSTALLED_CHROMIUM;
  return undefined; // ให้ playwright หาเองบนเครื่อง dev ปกติ
}

const argv = process.argv.slice(2);
const arg = (k, d = null) => {
  const i = argv.indexOf(`--${k}`);
  return i === -1 ? d : (argv[i + 1]?.startsWith('--') ? true : argv[i + 1]);
};
const flag = (k) => argv.includes(`--${k}`);

const url = arg('url');
const outDir = arg('out');
if (!url || !outDir) {
  console.error('ต้องมี --url และ --out');
  process.exit(1);
}

const width = parseInt(arg('width', '1440'), 10);
const height = parseInt(arg('height', '900'), 10);
const dpr = parseFloat(arg('dpr', '2'));
const views = parseInt(arg('views', '4'), 10);
const waitMs = parseInt(arg('wait', '2500'), 10);
const wantVideo = flag('video');
const selectors = (arg('sel', '') || '')
  .split(',')
  .filter(Boolean)
  .map((s) => {
    const i = s.indexOf('=');
    return { name: s.slice(0, i), sel: s.slice(i + 1) };
  });

// แบนเนอร์คุกกี้/ป็อปอัปที่บังภาพ — กดปิดถ้าเจอ
const CONSENT_TEXT = [
  'Accept all', 'Accept All', 'Allow all', 'I agree', 'Got it',
  'Accept cookies', 'Agree', 'OK', 'Continue',
];
const CONSENT_SEL = [
  '#onetrust-accept-btn-handler',
  '[aria-label*="accept" i]',
  'button[id*="accept" i]',
  'button[class*="accept" i]',
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: chromiumPath() });
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: dpr,
  recordVideo: wantVideo
    ? { dir: path.join(outDir, '_vid'), size: { width, height } }
    : undefined,
  // ลดโอกาสโดน bot-wall และให้หน้าเว็บโหลดเวอร์ชันเดสก์ท็อป
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  locale: 'en-US',
});

const page = await context.newPage();
console.log(`เปิด ${url}`);
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(async (e) => {
  console.warn(`networkidle ไม่มา (${e.message.split('\n')[0]}) — ใช้ domcontentloaded`);
  await page.waitForLoadState('domcontentloaded');
});

for (const sel of CONSENT_SEL) {
  const el = page.locator(sel).first();
  if (await el.count().catch(() => 0)) {
    await el.click({ timeout: 1500 }).catch(() => {});
  }
}
for (const t of CONSENT_TEXT) {
  const el = page.getByRole('button', { name: t, exact: true }).first();
  if (await el.count().catch(() => 0)) {
    await el.click({ timeout: 1200 }).catch(() => {});
    break;
  }
}

// โหลด lazy image ให้ครบก่อนแคปเต็มหน้า แล้วกลับขึ้นบนสุด
await page.evaluate(async () => {
  const step = window.innerHeight * 0.8;
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 120));
  }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(waitMs);

// ปิด animation ที่ทำให้ภาพนิ่งไม่ตรงกัน + ซ่อน header ที่ลอยตาม
await page.addStyleTag({
  content: `*,*::before,*::after{animation-play-state:paused !important;
            transition:none !important;scroll-behavior:auto !important}`,
});

const fullPath = path.join(outDir, 'full.png');
await page.screenshot({ path: fullPath, fullPage: true });
console.log(`  full.png`);

const pageHeight = await page.evaluate(() => document.body.scrollHeight);
for (let i = 0; i < views; i++) {
  const y = Math.round((pageHeight - height) * (i / Math.max(1, views - 1)));
  await page.evaluate((yy) => window.scrollTo(0, yy), Math.max(0, y));
  await page.waitForTimeout(500);
  const p = path.join(outDir, `view-${String(i + 1).padStart(2, '0')}.png`);
  await page.screenshot({ path: p });
  console.log(`  ${path.basename(p)} (y=${y})`);
}

for (const { name, sel } of selectors) {
  const el = page.locator(sel).first();
  if (!(await el.count().catch(() => 0))) {
    console.warn(`  ข้าม sel ${name}: ไม่เจอ ${sel}`);
    continue;
  }
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);
  const p = path.join(outDir, `sel-${name}.png`);
  await el.screenshot({ path: p }).catch(() => page.screenshot({ path: p }));
  console.log(`  ${path.basename(p)}`);
}

if (wantVideo) {
  // สกรอลล์ช้า ๆ ให้ได้คลิปที่ดูเป็นการเลื่อนหน้าเว็บจริง
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(700);
  await page.evaluate(async () => {
    const total = document.body.scrollHeight - window.innerHeight;
    const steps = 240;
    for (let i = 0; i <= steps; i++) {
      window.scrollTo(0, (total * i) / steps);
      await new Promise((r) => setTimeout(r, 33));
    }
  });
  await page.waitForTimeout(600);
}

const video = page.video();
await context.close();
if (video) {
  const src = await video.path();
  const dest = path.join(outDir, 'scroll.webm');
  await video.saveAs(dest);
  await rm(src, { force: true }).catch(() => {});
  console.log(`  scroll.webm`);
}
await browser.close();

const meta = { url, width, height, dpr, pageHeight, views, capturedAt: new Date().toISOString() };
await (await import('node:fs/promises')).writeFile(
  path.join(outDir, 'capture.json'),
  JSON.stringify(meta, null, 2),
);
console.log(`เสร็จ → ${outDir}`);
