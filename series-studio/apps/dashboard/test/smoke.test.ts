import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright-core';
import { createHttpServer } from '../../server/src/http/server.js';
import { makeTempStudio } from '../../server/test/helpers.js';
import { makeClip } from '../../server/test/clips.js';
import { BibleService } from '../../server/src/services/bible.js';
import { SeriesService } from '../../server/src/services/series.js';
import { EpisodeService } from '../../server/src/services/episode.js';
import { QcService } from '../../server/src/services/qc.js';
import { bible as fixtureBible, outline as fixtureOutline, script as fixtureScript, shots as fixtureShots } from '../../../packages/core/test/fixtures.js';

/**
 * M5 acceptance: approve G1..G4 from a phone-sized browser against the real server + built dashboard.
 * Skips when no Chromium is available.
 */
const DIST = join(__dirname, '..', 'dist');
const CANDIDATES = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', process.env['CHROME_PATH'] ?? ''];

function findChrome(): string | undefined {
  for (const c of CANDIDATES) if (c && existsSync(c)) return c;
  try {
    const p = chromium.executablePath();
    if (p && existsSync(p)) return p;
  } catch {
    /* no browser */
  }
  return undefined;
}

const chrome = findChrome();
const canRun = chrome !== undefined && existsSync(join(DIST, 'index.html'));

describe.skipIf(!canRun)('dashboard smoke (mobile viewport)', () => {
  const t = makeTempStudio({ assembly: { x264_preset: 'ultrafast', crf: 32 } });
  const token = 'smoke-token-0123456789abcdef';
  const { app } = createHttpServer(t.ctx, { token, dashboardDir: DIST });
  const SID = 'cafe-secret';
  let base = '';
  let browser: Browser;
  const strip = <T extends { refs?: unknown; locked?: unknown; ref_version?: unknown; flow_character_id?: unknown }>(e: T) => {
    const { refs: _r, locked: _l, ref_version: _v, flow_character_id: _f, ...rest } = e;
    return rest;
  };

  beforeAll(async () => {
    await app.listen({ host: '127.0.0.1', port: 0 });
    const addr = app.server.address();
    base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
    // data: series with bible + outline (G1 ready), refs locked later via UI? -> lock via service to keep the test short
    const series = new SeriesService(t.ctx);
    series.create({ id: SID, title: 'Cafe Secret', logline: 'บาริสต้ากับลูกค้าประจำ', style_id: 'live_kdrama_dub', aspect: '9:16', episodes: 1, ep_length_sec: 20, product: null });
    const bible = new BibleService(t.ctx, t.ctx.jobs);
    bible.write(SID, { story_md: '# s', characters: fixtureBible.characters.map(strip), locations: fixtureBible.locations.map(strip), props: fixtureBible.props.map(strip) });
    t.ctx.store.writeJson(series.outlineFile(SID, 1), fixtureOutline);
    const png = join(t.root, 'ref.png');
    writeFileSync(png, 'png');
    for (const [type, id] of [['character', 'mina'], ['character', 'tan'], ['location', 'cafe'], ['prop', 'letter']] as const) bible.importRefs(SID, type, id, [png]);
    browser = await chromium.launch({ executablePath: chrome!, headless: true });
  }, 60_000);
  afterAll(async () => {
    await browser?.close();
    await Promise.race([app.close(), new Promise((r) => setTimeout(r, 5000))]);
    t.cleanup();
  }, 20_000);

  it('approves G1 and G2 from the series page', async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    page.on('dialog', (d) => d.accept());
    await page.goto(`${base}/?token=${token}#/`, { waitUntil: 'networkidle' });
    await page.getByText('Cafe Secret').first().click();
    await page.getByRole('button', { name: 'อนุมัติ G1' }).click();
    await expect.poll(async () => new SeriesService(t.ctx).load(SID).gates.G1.approved, { timeout: 20_000 }).toBe(true);
    expect(new SeriesService(t.ctx).load(SID).gates.G1.via).toBe('dashboard');
    // lock every asset from the Bible tab (one click per asset, waiting for the server state), then approve G2
    await page.getByRole('button', { name: 'Bible', exact: true }).click();
    const lockedCount = () => {
      const svc = new SeriesService(t.ctx);
      const b = svc.loadBible(SID)!;
      return [...b.characters, ...b.locations, ...b.props].filter((e) => e.locked).length;
    };
    for (let i = 0; i < 4; i++) {
      const btn = page.getByRole('button', { name: 'ล็อก', exact: true }).first();
      await btn.waitFor({ state: 'visible', timeout: 20_000 });
      await btn.click();
      await expect.poll(lockedCount, { timeout: 20_000 }).toBe(i + 1);
      await page.waitForTimeout(300); // let the board re-render before the next click
    }
    const g2 = page.getByRole('button', { name: 'อนุมัติ G2' });
    await g2.waitFor({ state: 'visible', timeout: 20_000 });
    await g2.click();
    await expect.poll(async () => new SeriesService(t.ctx).load(SID).gates.G2.approved, { timeout: 20_000 }).toBe(true);
    await page.close();
  }, 60_000);

  it('approves G3 and G4 from the episode review page', async () => {
    // production data: script, shots, prompts, jobs, clips, QC (all green)
    const episodes = new EpisodeService(t.ctx);
    episodes.writeScript(SID, fixtureScript);
    episodes.writeShots(SID, fixtureShots);
    episodes.compilePrompts(SID, 1);
    await episodes.generate(SID, 1, { quality: 'draft' });
    const dl = join(t.root, 'dl');
    mkdirSync(dl);
    makeClip(join(dl, 'b01.mp4'), [['a', 3], ['b', 4]], true);
    makeClip(join(dl, 'b02.mp4'), [['a', 3.5], ['b', 3]], true);
    makeClip(join(dl, 'b03.mp4'), [['a', 3.5], ['b', 3]], true);
    episodes.importClips(SID, 1, { folder: dl });
    await new QcService(t.ctx).runQc(SID, 1);

    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    page.on('dialog', (d) => d.accept());
    await page.goto(`${base}/?token=${token}#/s/${SID}/ep/1?tab=review`, { waitUntil: 'networkidle' });
    const g3 = page.getByRole('button', { name: 'อนุมัติ G3' });
    await g3.waitFor({ state: 'visible', timeout: 20_000 });
    const [g3res] = await Promise.all([page.waitForResponse((r) => r.url().includes('/gates/G3'), { timeout: 30_000 }), g3.click()]);
    expect(g3res.status(), await g3res.text()).toBe(200);
    expect(new SeriesService(t.ctx).loadEpisodeState(SID, 1).gates.G3.approved).toBe(true);
    // final assembly runs ffmpeg on the server (tens of seconds): wait for the API response itself
    const build = page.getByRole('button', { name: 'ประกอบไฟล์จบ' });
    await build.waitFor({ state: 'visible', timeout: 20_000 });
    const [asmRes] = await Promise.all([page.waitForResponse((r) => r.url().includes('/assemble'), { timeout: 180_000 }), build.click()]);
    expect(asmRes.status(), await asmRes.text()).toBe(200);
    expect(existsSync(t.ctx.store.episodePath(SID, 1, 'final', 'ep01_9x16.mp4'))).toBe(true);
    const g4 = page.getByRole('button', { name: 'อนุมัติ G4' });
    await g4.waitFor({ state: 'visible', timeout: 20_000 });
    const [g4res] = await Promise.all([page.waitForResponse((r) => r.url().includes('/gates/G4'), { timeout: 30_000 }), g4.click()]);
    expect(g4res.status(), await g4res.text()).toBe(200);
    expect(new SeriesService(t.ctx).loadEpisodeState(SID, 1).gates.G4.approved).toBe(true);
    expect(new SeriesService(t.ctx).loadEpisodeState(SID, 1).status).toBe('final_ready');
    await page.close();
  }, 240_000);
});
