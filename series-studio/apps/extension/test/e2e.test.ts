import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type BrowserContext, type Worker } from 'playwright-core';
import { createHttpServer } from '../../server/src/http/server.js';
import { makeTempStudio } from '../../server/test/helpers.js';
import { makeClip } from '../../server/test/clips.js';
import { SeriesService } from '../../server/src/services/series.js';
import { BibleService } from '../../server/src/services/bible.js';
import { EpisodeService } from '../../server/src/services/episode.js';
import { GateService } from '../../server/src/services/gates.js';
import { bible as fixtureBible, outline as fixtureOutline, script as fixtureScript, shots as fixtureShots } from '../../../packages/core/test/fixtures.js';

/**
 * M6 end-to-end with the REAL extension code in headless Chromium: pairing through the popup,
 * WebSocket to the studio server, job dispatch, Flow-tab discovery, script injection, the driver
 * operating a mock Flow page (prompt, settings, reference upload, generate, result video), upload
 * of the result and the blocked/resume path. Only the real Flow DOM is simulated.
 */
const EXT = join(__dirname, '..');
const CHROME = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', process.env['CHROME_PATH'] ?? ''].find((p) => p && existsSync(p));

describe.skipIf(!CHROME)('extension e2e (headless Chromium + mock Flow)', () => {
  const t = makeTempStudio({ engines: { flow_ext: { minDelayMs: 0, maxDelayMs: 0, jobTimeoutSec: 60 } } });
  const token = 'e2e-token-0123456789abcdef';
  const { app } = createHttpServer(t.ctx, { token, dashboardDir: join(t.root, 'none') });
  const SID = 'cafe-secret';
  let base = '';
  let browser: BrowserContext;
  let sw: Worker;
  const mockState: Array<{ prompt: string; files: number; aspect: string; quality: string }> = [];
  const strip = <T extends { refs?: unknown; locked?: unknown; ref_version?: unknown; flow_character_id?: unknown }>(e: T) => {
    const { refs: _r, locked: _l, ref_version: _v, flow_character_id: _f, ...rest } = e;
    return rest;
  };
  const waitFor = async (pred: () => boolean, ms = 30_000, label = 'condition') => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (pred()) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`timeout waiting for ${label}`);
  };

  beforeAll(async () => {
    // mock Flow page served by the same server
    const tiny = makeClip(join(t.root, 'tiny.mp4'), [['a', 1.5]], true);
    const dataUrl = `data:video/mp4;base64,${readFileSync(tiny).toString('base64')}`;
    app.get('/mockflow', async (_req, reply) =>
      reply.type('text/html; charset=utf-8').send(`<!doctype html><html><head><meta charset="utf-8"><title>Mock Flow</title></head><body>
<h1>Mock Flow</h1>
<textarea id="prompt" placeholder="Describe your video"></textarea>
<button id="settings">Settings</button>
<div id="menu" hidden><button class="opt" data-aspect="9:16">9:16</button><button class="opt" data-aspect="16:9">16:9</button><button class="opt" data-q="Fast">Fast</button><button class="opt" data-q="Quality">Quality</button></div>
<button id="add">Ingredients</button><input id="file" type="file" multiple hidden>
<button id="generate">Generate</button>
<div id="out"></div>
<script>
const st = { aspect: '', quality: '', files: 0 };
document.getElementById('settings').onclick = () => { document.getElementById('menu').hidden = false; };
for (const b of document.querySelectorAll('.opt')) b.onclick = () => { if (b.dataset.aspect) st.aspect = b.dataset.aspect; if (b.dataset.q) st.quality = b.dataset.q; };
document.getElementById('add').onclick = () => { document.getElementById('file').hidden = false; };
document.getElementById('file').onchange = (e) => { st.files = e.target.files.length; };
document.getElementById('generate').onclick = async () => {
  const prompt = document.getElementById('prompt').value;
  await fetch('/mockflow/state', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt, ...st }) });
  setTimeout(() => { document.getElementById('out').innerHTML = '<video id="result" src="${dataUrl}"></video>'; }, 600);
};
</script></body></html>`),
    );
    app.post('/mockflow/state', async (req) => {
      mockState.push(req.body as { prompt: string; files: number; aspect: string; quality: string });
      return { ok: true };
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const addr = app.server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    base = `http://127.0.0.1:${port}`;
    writeFileSync(
      join(t.root, 'config', 'flow-selectors.json'),
      JSON.stringify({
        version: 1,
        flow_url_prefixes: [`${base}/mockflow`],
        flow_home_url: `${base}/mockflow`,
        wait_sec: 5,
        selectors: {
          prompt_textarea: '#prompt',
          generate_button: '#generate',
          settings_button: '#settings',
          aspect_9_16: "button.opt:has-text('9:16')",
          aspect_16_9: "button.opt:has-text('16:9')",
          quality_draft: "button.opt:has-text('Fast')",
          quality_final: "button.opt:has-text('Quality')",
          add_ingredient_button: '#add',
          file_input: '#file',
          result_video: 'video#result',
          error_banner: '[role=alert]',
        },
      }),
    );

    // series on the flow_ext engine, ready to generate
    const series = new SeriesService(t.ctx);
    series.create({ id: SID, title: 'Cafe Secret', logline: 'x', style_id: 'live_kdrama_dub', aspect: '9:16', episodes: 1, ep_length_sec: 20, product: null, engine_id: 'flow_ext' });
    const bible = new BibleService(t.ctx, t.ctx.jobs);
    bible.write(SID, { story_md: '# s', characters: fixtureBible.characters.map(strip), locations: fixtureBible.locations.map(strip), props: fixtureBible.props.map(strip) });
    t.ctx.store.writeJson(series.outlineFile(SID, 1), fixtureOutline);
    const png = join(t.root, 'ref.png');
    writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
    for (const [type, id] of [['character', 'mina'], ['character', 'tan'], ['location', 'cafe'], ['prop', 'letter']] as const) {
      bible.importRefs(SID, type, id, [png]);
      bible.lock(SID, type, id);
    }
    const gates = new GateService(t.ctx);
    gates.approve(SID, 'G1', {});
    gates.approve(SID, 'G2', {});
    const episodes = new EpisodeService(t.ctx);
    episodes.writeScript(SID, fixtureScript);
    episodes.writeShots(SID, fixtureShots);
    episodes.compilePrompts(SID, 1);

    // real extension in headless Chromium
    browser = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'pw-ext-')), {
      executablePath: CHROME!,
      headless: true,
      args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
    });
    sw = browser.serviceWorkers()[0] ?? (await browser.waitForEvent('serviceworker', { timeout: 15_000 }));
  }, 90_000);

  afterAll(async () => {
    await browser?.close();
    t.ctx.ext?.close();
    await Promise.race([app.close(), new Promise((r) => setTimeout(r, 5000))]);
    t.cleanup();
  }, 20_000);

  it('pairs through the popup and connects to the server over WebSocket', async () => {
    const id = new URL(sw.url()).host;
    const popup = await browser.newPage();
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.fill('#port', String(new URL(base).port));
    await popup.fill('#token', token);
    await popup.click('#pair');
    await waitFor(() => t.ctx.ext?.status().connected === true, 15_000, 'extension connected');
    await expect.poll(async () => (await popup.textContent('#status')) ?? '', { timeout: 10_000 }).toContain('เชื่อมต่อ studio-server แล้ว');
    await popup.close();
  }, 30_000);

  it('runs every batch of the episode through the mock Flow page and uploads the clips', async () => {
    const episodes = new EpisodeService(t.ctx);
    const jobs = await episodes.generate(SID, 1, { quality: 'draft' });
    expect(jobs.length).toBe(3);
    await waitFor(() => t.ctx.jobs.list({ series_id: SID, episode: 1, kind: 'clip' }).every((j) => j.status === 'done'), 90_000, 'all jobs done');
    for (const b of ['b01', 'b02', 'b03']) expect(existsSync(t.ctx.store.episodePath(SID, 1, 'gen', b, 'v1.mp4'))).toBe(true);
    expect(new SeriesService(t.ctx).loadEpisodeState(SID, 1).status).toBe('qc');
    expect(mockState.length).toBe(3);
    expect(mockState[0]?.prompt).toContain('[STYLE]');
    expect(mockState[0]).toMatchObject({ aspect: '9:16', quality: 'Fast' });
    expect(mockState[0]?.files).toBeGreaterThan(0); // reference images were fetched and attached
    // the extension reused one Flow tab for all three jobs
    const flowTabs = browser.pages().filter((p) => p.url().startsWith(`${base}/mockflow`));
    expect(flowTabs.length).toBe(1);
  }, 120_000);

  it('stops safely on an unknown page (selector missing), then resumes after the selectors are fixed', async () => {
    const selFile = join(t.root, 'config', 'flow-selectors.json');
    const good = readFileSync(selFile, 'utf8');
    writeFileSync(selFile, good.replace('"#prompt"', '"#prompt-renamed-by-flow"'));
    const episodes = new EpisodeService(t.ctx);
    const [job] = await episodes.generate(SID, 1, { batch_ids: ['b01'], quality: 'draft', fix_notes: 'take 2' });
    await waitFor(() => t.ctx.jobs.get(job!.id)?.status === 'blocked', 30_000, 'blocked');
    expect(t.ctx.jobs.get(job!.id)?.error).toContain('prompt_textarea');
    expect(t.ctx.ext?.status().halted).toBeTruthy();
    writeFileSync(selFile, good);
    const [again] = await episodes.generate(SID, 1, { batch_ids: ['b02'], quality: 'draft' });
    await new Promise((r) => setTimeout(r, 500));
    expect(t.ctx.jobs.get(again!.id)?.status).toBe('queued'); // halted: not dispatched
    t.ctx.ext!.resume();
    await waitFor(() => t.ctx.jobs.get(again!.id)?.status === 'done', 60_000, 'job after resume');
    expect(existsSync(t.ctx.store.episodePath(SID, 1, 'gen', 'b02', 'v2.mp4'))).toBe(true);
  }, 120_000);
});
