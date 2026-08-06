// End to end, the way a customer does it: a real browser opens the built site,
// types into the real form, clicks the real button — and the enquiry has to
// come out the other side of the Worker as a LINE message.
//
// Everything here is the shipped artefact except api.line.me, which is the
// stub in fake-line.mjs. Unit tests prove the Worker's rules; this proves the
// three pieces are actually connected, which is the part that silently is not.
//
//   node form-worker/test/e2e.mjs <site-dir> <form-selector> <worker-url> <log-file>
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const [siteDir, page, workerUrl, logFile] = process.argv.slice(2);
const dist = resolve(join(siteDir, 'dist'));
const PORT = 4321; // must match the origin in the Worker's test SITES config

const TYPES = { html: 'text/html', svg: 'image/svg+xml', webp: 'image/webp', txt: 'text/plain', xml: 'application/xml' };
const server = createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  let file = resolve(dist, rel);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(dist) || !existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[file.split('.').pop()] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const origin = `http://127.0.0.1:${PORT}`;

const { chromium } = await import('playwright');
const pinned = process.env.PLAYWRIGHT_CHROMIUM ?? '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(pinned) ? { executablePath: pinned } : {});

const before = readFileSync(logFile, 'utf8').split('\n').filter(Boolean).length;
const problems = [];
const check = (ok, msg) => { console.log(`${ok ? '  ok  ' : '  FAIL'} ${msg}`); if (!ok) problems.push(msg); };

const browserPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
browserPage.on('pageerror', e => errors.push(String(e)));
browserPage.on('console', m => m.type() === 'error' && errors.push(m.text()));

await browserPage.goto(origin + page, { waitUntil: 'load' });
// Point the page at the Worker exactly as a deployed site would be configured.
await browserPage.evaluate(url => { window.FORM_ENDPOINT = url; }, workerUrl);

// The Worker drops anything filled in faster than a person could type.
await browserPage.waitForTimeout(3000);

const form = await browserPage.$('form#bookForm, form#quoteForm');
check(!!form, 'the page has a contact form');

const fill = async (name, value) => {
  const el = await form.$(`[name="${name}"]`);
  if (!el) return;
  const tag = await el.evaluate(n => n.tagName);
  if (tag === 'SELECT') await el.selectOption({ index: 1 });
  else await el.fill(value);
};
await fill('name', 'ทดสอบ จากเบราว์เซอร์');
await fill('tel', '0812345678');
await fill('size', '42');
await fill('note', 'ส่งจาก Playwright\nบรรทัดที่สอง');
await fill('type', '');

const hp = await form.$('[name="wlc_hp"]');
check(!!hp, 'the honeypot field is present in the markup');
if (hp) {
  // Playwright calls an off-screen element "visible" — it has a box and is not
  // display:none. What matters to a person is whether any of that box lands in
  // the viewport, so measure that instead.
  const box = await hp.boundingBox();
  check(!box || box.x + box.width < 0 || box.y + box.height < 0,
    `the honeypot sits off-screen (box ${box ? `${Math.round(box.x)},${Math.round(box.y)}` : 'none'})`);
  check(await hp.evaluate(n => n.tabIndex === -1), 'the honeypot is out of the tab order');
  check(await hp.evaluate(n => !!n.closest('[aria-hidden=true]')), 'the honeypot is out of the accessibility tree');
}

await form.$eval('[type=submit]', b => b.click());
await browserPage.waitForTimeout(1500);

check(await browserPage.isVisible('.form-ok'), 'the page shows the success panel');
check(!(await browserPage.isVisible('.form-err.show')), 'no error message is shown');
check(errors.length === 0, `no script errors${errors.length ? ' → ' + errors[0] : ''}`);

const lines = readFileSync(logFile, 'utf8').split('\n').filter(Boolean);
check(lines.length === before + 1, `exactly one LINE message arrived (got ${lines.length - before})`);
if (lines.length > before) {
  const text = JSON.parse(lines.at(-1)).messages[0].text;
  console.log('\n─── message delivered to LINE ───');
  console.log(text);
  console.log('─────────────────────────────────\n');
  check(/เบอร์โทร: 0812345678/.test(text), 'the phone number came through');
  check(/ทดสอบ จากเบราว์เซอร์/.test(text), 'the name came through');
  check(/ {2}บรรทัดที่สอง/.test(text), 'the multi-line note came through, indented');
}

// And the bot path: the same form, with the honeypot filled, must go nowhere.
const botBefore = readFileSync(logFile, 'utf8').split('\n').filter(Boolean).length;
await browserPage.reload({ waitUntil: 'load' });
await browserPage.evaluate(url => { window.FORM_ENDPOINT = url; }, workerUrl);
await browserPage.waitForTimeout(3000);
const form2 = await browserPage.$('form#bookForm, form#quoteForm');
await form2.$eval('[name="tel"]', (n, v) => { n.value = v; }, '0899999999');
await form2.$eval('[name="wlc_hp"]', n => { n.value = 'http://spam.example'; });
await form2.$eval('[type=submit]', b => b.click());
await browserPage.waitForTimeout(1500);
const after = readFileSync(logFile, 'utf8').split('\n').filter(Boolean).length;
check(after === botBefore, 'a submission with the honeypot filled reaches nobody');

// The failure path, which is the one that decides whether a lost enquiry is
// lost silently. Point the page at a dead endpoint and the visitor must be
// told, and given the phone number — not shown a success panel for a message
// that never left the browser.
await browserPage.reload({ waitUntil: 'load' });
await browserPage.evaluate(() => { window.FORM_ENDPOINT = 'http://127.0.0.1:1/'; });
await browserPage.waitForTimeout(3000);
const form3 = await browserPage.$('form#bookForm, form#quoteForm');
await form3.$eval('[name="tel"]', (n, v) => { n.value = v; }, '0877777777');
await form3.$eval('[type=submit]', b => b.click());
await browserPage.waitForTimeout(2000);
check(await browserPage.isVisible('.form-err.show'), 'a delivery failure is shown to the visitor');
check(!(await browserPage.isVisible('.form-ok')), 'no false success panel when nothing was delivered');
check(await browserPage.$eval('.form-err a[href^="tel:"]', a => !!a).catch(() => false),
  'the failure message offers a phone number instead');
check(await browserPage.$eval('form [type=submit]', b => !b.disabled),
  'the button is usable again, so they can retry');

await browser.close();
server.close();

if (problems.length) {
  console.log(`\n${problems.length} problem(s)`);
  process.exitCode = 1;
} else {
  console.log('PASS — the form, the Worker and LINE are connected end to end');
}
