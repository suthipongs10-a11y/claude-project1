/**
 * Screenshot every dashboard screen at phone size against the real data in projects/.
 * Run: pnpm --filter @series-studio/dashboard exec tsx scripts/screenshots.ts [outDir]
 */
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createContext } from '../../server/src/context.js';
import { createHttpServer } from '../../server/src/http/server.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const dist = join(here, '..', 'dist');
const out = process.argv[2] ?? join(here, '..', '..', '..', 'data', 'screenshots');
const chrome = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', process.env['CHROME_PATH'] ?? ''].find((p) => p && existsSync(p));

async function main() {
  mkdirSync(out, { recursive: true });
  const ctx = createContext({ logger: 'silent' });
  const token = 'shot-token-0123456789abcdef';
  const { app } = createHttpServer(ctx, { token, dashboardDir: dist });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const addr = app.server.address();
  const base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  const series = process.env['DEMO_SERIES_ID'] ?? 'cafe-secret';
  const pages: Array<[string, string]> = [
    ['01-series-list', '#/'],
    ['02-wizard', '#/new'],
    ['03-series-episodes', `#/s/${series}`],
    ['04-bible-board', `#/s/${series}?tab=bible`],
    ['05-shot-grid', `#/s/${series}/ep/1`],
    ['06-review-player', `#/s/${series}/ep/1?tab=review`],
    ['07-queue-cost', '#/queue'],
    ['08-settings', '#/settings'],
  ];
  const browser = await chromium.launch(chrome ? { executablePath: chrome, headless: true } : { headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  for (const [name, hash] of pages) {
    await page.goto(`${base}/?token=${token}${hash}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(out, `${name}.png`), fullPage: name !== '06-review-player' });
    console.log('saved', name);
  }
  await browser.close();
  await app.close();
  ctx.jobs.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
