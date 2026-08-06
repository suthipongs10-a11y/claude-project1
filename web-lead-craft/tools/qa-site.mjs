#!/usr/bin/env node
// Pre-handover QA. Loads a built site in a real browser at desktop and phone
// widths and reports what eyes miss: script errors, sideways scroll, missing
// alt text, tap targets too small for a thumb, dead contact links, SEO text
// lengths. Screenshots land in <site-dir>/.qa/ (gitignored) to eyeball after.
//
// Every finding here has already shipped broken at least once. Run it before
// every client handover.
//
// Usage: node tools/qa-site.mjs <site-dir>
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: qa-site.mjs <site-dir>');
  process.exit(1);
}
const dist = resolve(join(dir, 'dist'));
if (!existsSync(join(dist, 'index.html'))) {
  console.error(`no build at ${dist} — run: node tools/build-site.mjs ${dir}`);
  process.exit(1);
}

// Every built page, in every language, at both widths. English runs longer
// than Thai in the same boxes, so overflow and clipping show up there first,
// and a multi-page site fails on the page nobody thought to open. Extra
// languages are reached by working the switch exactly as a visitor would.
const cfg = JSON.parse(readFileSync(join(dir, 'site.json'), 'utf8'));
const DEFAULT_LANG = cfg.lang ?? 'th';
const LANGS = (cfg.languages ?? [{ code: DEFAULT_LANG }]).map(l => l.code);
const html = d => (existsSync(d) ? readdirSync(d).filter(f => f.endsWith('.html') && f !== '404.html') : []);
const URLS = [
  ...html(dist).map(f => `/${f}`),
  ...html(join(dist, 'articles')).map(f => `/articles/${f}`),
].sort((a, b) => (a === '/index.html' ? -1 : b === '/index.html' ? 1 : a.localeCompare(b)));
const PAGES = LANGS.flatMap(code => URLS.map(url => ({ code, url })));

// Serve over HTTP rather than file://, so root-absolute paths like
// /favicon.svg and /en/ resolve the way they will once deployed.
const TYPES = { html: 'text/html', svg: 'image/svg+xml', txt: 'text/plain', xml: 'application/xml', webp: 'image/webp' };
const server = createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  let file = resolve(dist, rel);
  // a directory URL such as /en/ serves that folder's index.html
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(dist) || !existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/html' });
    res.end(existsSync(join(dist, '404.html')) ? readFileSync(join(dist, '404.html')) : 'not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[file.split('.').pop()] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('playwright missing — run: npm install (inside web-lead-craft/)');
  process.exit(1);
}

const shotDir = join(dir, '.qa');
mkdirSync(shotDir, { recursive: true });

const VIEWPORTS = [
  ['desktop', { width: 1440, height: 900 }],
  ['phone', { width: 390, height: 844 }],
];
const MIN_TAP = 44; // iOS Human Interface Guidelines minimum
const problems = [];
const layouts = [];
const linkTargets = new Map(); // href -> the page that links to it
const titlesSeen = new Map(); // title text -> the page that used it first
const note = (where, msg) => problems.push(`${where}: ${msg}`);

// Use a pre-provisioned browser when one is present (some sandboxes ship
// Chromium at a fixed path); otherwise let Playwright resolve its own, which
// is what happens on an ordinary Windows or macOS install.
const pinned = process.env.PLAYWRIGHT_CHROMIUM ?? '/opt/pw-browsers/chromium';
let browser;
try {
  browser = await chromium.launch(existsSync(pinned) ? { executablePath: pinned } : {});
} catch (err) {
  console.error(`could not start Chromium: ${err.message.split('\n')[0]}`);
  console.error('run: npx playwright install chromium');
  process.exit(1);
}

const slugOf = url => url.replace(/^\//, '').replace(/\.html$/, '').replace(/\//g, '-') || 'index';
for (const pg of PAGES) for (const [size, viewport] of VIEWPORTS) {
  const many = URLS.length > 1;
  const label = [many ? slugOf(pg.url) : null, LANGS.length > 1 ? pg.code : null, size].filter(Boolean).join(' ');
  const shot = [many ? slugOf(pg.url) : null, LANGS.length > 1 ? pg.code : null, size].filter(Boolean).join('-');
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('requestfailed', r => errors.push(`request failed: ${r.url().slice(0, 90)}`));

  await page.goto(origin + pg.url, { waitUntil: 'load' });
  if (pg.code !== DEFAULT_LANG) {
    const btn = await page.$(`[data-set-lang="${pg.code}"]`);
    if (!btn) {
      note(label, `no switch button for "${pg.code}" — that language is unreachable`);
      await page.close();
      continue;
    }
    await btn.click();
    await page.waitForTimeout(250);
  }
  // the staged chat/hero animation only exists on a home page
  await page.waitForTimeout(pg.url === '/index.html' ? 4200 : 900);

  // walk the page so IntersectionObserver reveals every section
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto';
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y <= h; y += 400) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 80));
    }
    await new Promise(r => setTimeout(r, 600));
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);

  const found = await page.evaluate(minTap => {
    const vis = el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    };
    const noAlt = [...document.querySelectorAll('img')]
      .filter(i => i.alt === null || i.alt.trim() === '')
      .map(i => i.getAttribute('src')?.slice(0, 60) ?? '(inline)');

    // A card carrying a .stretch-link is one hit area covering the whole card,
    // so the small links inside it are not the tap target and measuring their
    // own boxes says nothing useful.
    const stretched = new Set();
    for (const s of document.querySelectorAll('.stretch-link')) {
      let p = s.parentElement;
      while (p && p !== document.body) {
        if (getComputedStyle(p).position === 'relative') { stretched.add(p); break; }
        p = p.parentElement;
      }
    }
    const inStretchedCard = el => [...stretched].some(c => c.contains(el));

    const small = [];
    for (const el of document.querySelectorAll('a, button, input[type=submit]')) {
      if (!vis(el) || inStretchedCard(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < minTap || r.height < minTap) {
        const name = (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 34)
          || `<${el.tagName.toLowerCase()} class="${el.className}">`;
        small.push(`${name} (${Math.round(r.width)}x${Math.round(r.height)})`);
      }
    }

    // content still invisible after a full scroll means reveal animation stuck
    const stuck = [...document.querySelectorAll('.rv')].filter(el => Number(getComputedStyle(el).opacity) < 0.5).length;

    // Two ways an <img> goes wrong that a screenshot review can miss.
    const badImages = [];
    for (const im of document.querySelectorAll('img')) {
      if (!vis(im)) continue;
      const r = im.getBoundingClientRect();
      const name = (im.currentSrc || im.src).split('/').pop().split('?')[0].slice(0, 40);
      // stretched: object-fit lets the box differ from the file, fill does not
      if (getComputedStyle(im).objectFit === 'fill' && im.naturalWidth) {
        const drawn = r.width / r.height;
        const natural = im.naturalWidth / im.naturalHeight;
        if (Math.abs(drawn - natural) / natural > 0.02) {
          badImages.push(`${name} distorted (drawn ${drawn.toFixed(2)}:1 vs file ${natural.toFixed(2)}:1)`);
        }
      }
      // runaway box: usually a height attribute beating a CSS aspect-ratio
      if (r.height > r.width * 2.2) {
        badImages.push(`${name} renders ${Math.round(r.width)}x${Math.round(r.height)} — far taller than wide, check height:auto`);
      }
    }

    // an in-page anchor with no matching target is a dead link
    const deadAnchors = [...document.querySelectorAll('a[href^="#"]')]
      .map(a => a.getAttribute('href'))
      .filter(h => h.length > 1 && !document.querySelector(h));

    // every same-site link, resolved, so the runner can fetch each one
    const localLinks = [...new Set([...document.querySelectorAll('a[href]')]
      .map(a => a.href)
      .filter(h => h.startsWith(location.origin))
      .map(h => h.slice(location.origin.length).split('#')[0])
      .filter(Boolean))];

    // Content escaping its container sideways. The page-level overflow check
    // misses this whenever something else clips the page, and translated copy
    // is the usual cause: a phrase that fits in one language does not in the
    // next, and lands on top of whatever sits beside it.
    const spills = [];
    for (const el of document.querySelectorAll('main *, header *, footer *')) {
      if (!vis(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.position === 'absolute' || cs.position === 'fixed') continue;
      const parent = el.parentElement;
      if (!parent) continue;
      const pcs = getComputedStyle(parent);
      if (pcs.overflow !== 'visible' || pcs.overflowX !== 'visible') continue;
      const pr = parent.getBoundingClientRect();
      const inner = {
        left: pr.left + parseFloat(pcs.paddingLeft) + parseFloat(pcs.borderLeftWidth),
        right: pr.right - parseFloat(pcs.paddingRight) - parseFloat(pcs.borderRightWidth),
      };
      if (inner.right - inner.left <= 0) continue;
      const r = el.getBoundingClientRect();
      const over = Math.round(Math.max(r.right - inner.right, inner.left - r.left));
      if (over > 4) {
        const what = el.className && typeof el.className === 'string'
          ? '.' + el.className.trim().split(/\s+/)[0]
          : el.tagName.toLowerCase();
        spills.push(`${what} spills ${over}px out of ${parent.className ? '.' + String(parent.className).trim().split(/\s+/)[0] : parent.tagName.toLowerCase()}`);
      }
    }

    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      noAlt,
      small: [...new Set(small)],
      badImages: [...new Set(badImages)],
      spills: [...new Set(spills)],
      stuck,
      deadAnchors: [...new Set(deadAnchors)],
      localLinks,
      tel: document.querySelectorAll('a[href^="tel:"]').length,
      title: (document.title || '').length,
      titleText: document.title || '',
      desc: (document.querySelector('meta[name=description]')?.content || '').length,
      h1: document.querySelectorAll('h1').length,
      favicon: !!document.querySelector('link[rel~=icon]'),
      lang: document.documentElement.lang || '(none)',
      switchTo: [...document.querySelectorAll('[data-set-lang]')].map(b => b.dataset.setLang),
      // the whole single-page mechanism in one number: with a language
      // active, nothing belonging to another one may still be on screen
      wrongLang: [...document.querySelectorAll('[data-t]')]
        .filter(el => el.getAttribute('lang') !== document.documentElement.lang && vis(el))
        .map(el => (el.textContent || '').trim().slice(0, 30)),
      // an attribute the switch failed to update stays in the old language
      staleAttrs: (() => {
        const d = document.getElementById('i18n-data');
        if (!d) return [];
        const D = JSON.parse(d.textContent);
        const code = document.documentElement.lang;
        const bad = [];
        for (const key of Object.keys(D.nodes)) {
          const el = document.querySelector(`[data-ti="${key}"]`);
          if (!el) { bad.push(`node ${key} missing`); continue; }
          const entry = D.nodes[key];
          if (entry.text && el.textContent.trim() !== String(entry.text[code]).trim()) {
            bad.push(`option text still "${el.textContent.trim().slice(0, 24)}"`);
          }
          for (const name of Object.keys(entry.attr || {})) {
            if (el.getAttribute(name) !== entry.attr[name][code]) bad.push(`${name} on <${el.tagName.toLowerCase()}>`);
          }
        }
        return bad;
      })(),
      // Widths of containers that are *supposed* to fill their track, keyed by
      // a stable path and compared across languages afterwards. Such a width
      // is decided by layout, never by the copy — so when it moves because the
      // text got longer, a grid track is being sized by its content.
      // Shrink-to-fit boxes are excluded: their width follows the text by
      // design, and flagging them would bury the real finding.
      boxes: (() => {
        const out = {};
        const seen = new Map();
        const STRETCH = new Set(['normal', 'stretch', 'auto']);
        for (const el of document.querySelectorAll('section [class], header [class], footer [class]')) {
          const r = el.getBoundingClientRect();
          if (r.width < 200) continue;
          const cs = getComputedStyle(el);
          if (cs.display === 'inline' || cs.position === 'absolute' || cs.position === 'fixed') continue;
          const parent = el.parentElement;
          if (!parent) continue;
          const pcs = getComputedStyle(parent);
          // a flex row sizes its items from their content on purpose
          if (pcs.display === 'flex' || pcs.display === 'inline-flex') continue;
          if (!STRETCH.has(pcs.justifyItems) || !STRETCH.has(cs.justifySelf)) continue;
          if (cs.width === 'max-content' || cs.width === 'fit-content') continue;
          const key = el.className.trim().split(/\s+/).filter(c => c !== 'in').join('.');
          const n = (seen.get(key) ?? 0) + 1;
          seen.set(key, n);
          out[`${key}#${n}`] = Math.round(r.width);
        }
        return out;
      })(),
    };
  }, MIN_TAP);

  await page.screenshot({ path: join(shotDir, `${shot}.png`), fullPage: true });

  if (errors.length) note(label, `script/network errors → ${[...new Set(errors)].slice(0, 3).join(' | ')}`);
  if (found.overflow > 0) note(label, `page scrolls sideways by ${found.overflow}px`);
  if (found.stuck) note(label, `${found.stuck} section(s) still invisible after scrolling — reveal animation stuck`);
  if (found.noAlt.length) note(label, `${found.noAlt.length} image(s) without alt text → ${found.noAlt.slice(0, 3).join(', ')}`);
  for (const b of found.badImages) note(label, b);
  for (const s of (found.spills ?? []).slice(0, 6)) note(label, s);
  if (found.deadAnchors.length) note(label, `anchor links point nowhere → ${found.deadAnchors.join(', ')}`);
  if (size === 'phone') {
    // list every one — a QA tool that truncates its findings hides work
    for (const t of found.small) note(label, `tap target under ${MIN_TAP}px → ${t}`);
    if (!found.tel) note(label, 'no tel: link — a phone visitor cannot tap to call');
  }
  if (size === 'desktop') {
    const seo = `seo ${[URLS.length > 1 ? slugOf(pg.url) : null, LANGS.length > 1 ? pg.code : null].filter(Boolean).join(' ')}`.trim();
    if (found.h1 !== 1) note(seo, `page has ${found.h1} <h1> tags, want exactly 1`);
    if (found.title < 15 || found.title > 65) note(seo, `<title> is ${found.title} chars, aim for 15–65`);
    if (found.desc < 70 || found.desc > 165) note(seo, `meta description is ${found.desc} chars, aim for 70–165`);
    if (!found.favicon) note(seo, 'no favicon link in <head>');
    if (found.lang === '(none)') note(seo, '<html> has no lang attribute');
    else if (found.lang !== pg.code) note(seo, `switched to ${pg.code} but <html lang="${found.lang}">`);
    for (const code of LANGS) {
      if (LANGS.length > 1 && !found.switchTo.includes(code)) note(seo, `no way to switch to "${code}" from the page`);
    }
    if (found.titleText && titlesSeen.has(found.titleText)) {
      note(seo, `<title> is identical to ${titlesSeen.get(found.titleText)} — every page needs its own`);
    } else if (found.titleText) titlesSeen.set(found.titleText, slugOf(pg.url));
  }
  if (found.wrongLang?.length) {
    note(label, `${found.wrongLang.length} phrase(s) from another language still visible → "${found.wrongLang[0]}"`);
  }
  for (const s of (found.staleAttrs ?? []).slice(0, 5)) note(label, `switch did not update: ${s}`);
  layouts.push({ url: pg.url, code: pg.code, size, boxes: found.boxes });
  // links between pages are what a multi-page site breaks on, and a 404 here
  // is silent to anyone not clicking every one of them
  for (const href of found.localLinks) {
    if (!linkTargets.has(href)) linkTargets.set(href, `${slugOf(pg.url)} (${pg.code})`);
  }
  await page.close();
}

// Same element, same page, same viewport, different language: a layout
// container whose width moves with the copy is a track being sized by content.
if (LANGS.length > 1) {
  for (const url of URLS) for (const [size] of VIEWPORTS) {
    const [base, ...rest] = layouts.filter(l => l.size === size && l.url === url);
    if (!base) continue;
    for (const other of rest) {
      const drifted = [];
      for (const [key, w] of Object.entries(base.boxes)) {
        const w2 = other.boxes[key];
        if (w2 === undefined) continue;
        if (Math.abs(w - w2) / Math.max(w, w2) > 0.12) {
          drifted.push(`.${key.split('#')[0]} is ${w}px in ${base.code} but ${w2}px in ${other.code}`);
        }
      }
      const where = `layout ${URLS.length > 1 ? slugOf(url) + ' ' : ''}${size}`;
      for (const d of drifted.slice(0, 4)) note(where, `${d} — a grid/flex track is being sized by its text`);
      if (drifted.length > 4) note(where, `…and ${drifted.length - 4} more container(s) differing between languages`);
    }
  }
}

// Follow every internal link once. A broken one between pages is invisible
// until a visitor clicks it, and nobody clicks all of them by hand.
for (const [href, from] of linkTargets) {
  const res = await fetch(origin + href).catch(() => null);
  if (!res || !res.ok) note('links', `${href} is broken (linked from ${from})`);
}

// A cookie bar is a promise in writing: the privacy page says analytics does
// not load until the visitor accepts. Nothing about the markup proves that, so
// drive it — fresh visitor, both answers, and a reload after each. The gtag
// request is intercepted, so this never actually reaches Google.
const cookiePages = URLS.filter(u => readFileSync(join(dist, u.slice(1))).includes('id="cookie"'));
if (cookiePages.length) {
  const TRACKER = /googletagmanager\.com|google-analytics\.com/;
  const visit = async (seed, act) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    // The demo ships GA_ID empty, so there would be nothing for the gate to
    // gate. Stand in for a client who filled it in: hold a test ID and ignore
    // the page's own empty assignment, keeping any real one it sets.
    await ctx.addInitScript(() => {
      let id = 'G-QATEST01';
      Object.defineProperty(window, 'GA_ID', {
        get: () => id,
        set: v => { if (v) id = v; },
        configurable: true,
      });
    });
    await ctx.route('**/*', r => (TRACKER.test(r.request().url()) ? r.fulfill({ body: '', contentType: 'text/javascript' }) : r.continue()));
    const page = await ctx.newPage();
    const hits = [];
    page.on('request', r => TRACKER.test(r.url()) && hits.push(r.url()));
    await page.goto(origin + cookiePages[0], { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const shown = await page.isVisible('#cookie.show');
    if (seed) await page.click(seed === 'yes' ? '#cookieOk' : '#cookieNo');
    await page.waitForTimeout(400);
    const out = await act({ page, hits, shown });
    await ctx.close();
    return out;
  };

  const first = await visit(null, async ({ hits, shown }) => ({ shown, hits: hits.length }));
  if (!first.shown) note('consent', 'the cookie bar never appears for a first-time visitor');
  if (first.hits) note('consent', `analytics loaded before any answer was given (${first.hits} request(s))`);

  for (const answer of ['no', 'yes']) {
    const r = await visit(answer, async ({ page, hits }) => {
      const dismissed = !(await page.isVisible('#cookie.show'));
      const stored = await page.evaluate(() => { try { return localStorage.getItem('cookie'); } catch { return null; } });
      const loadedOnAnswer = hits.length;
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(1500);
      return { dismissed, stored, loadedOnAnswer, again: await page.isVisible('#cookie.show'), loaded: hits.length };
    });
    if (!r.dismissed) note('consent', `"${answer}" does not dismiss the bar`);
    if (r.stored !== answer) note('consent', `"${answer}" stored as "${r.stored}" — the choice will not survive a reload`);
    if (r.again) note('consent', `the bar comes back after answering "${answer}" — a visitor is asked on every page view`);
    if (answer === 'no' && r.loaded) note('consent', `"essential only" was chosen and analytics loaded anyway (${r.loaded} request(s))`);
    if (answer === 'yes' && !r.loadedOnAnswer) note('consent', 'accepting does not load analytics — the consent gate never opens');
    if (answer === 'yes' && !r.loaded) note('consent', 'analytics does not load on a return visit that already accepted');
  }
}

// the 404 page ships too, so it gets checked as well
if (existsSync(join(dist, '404.html'))) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('requestfailed', r => errs.push(`request failed: ${r.url().slice(0, 90)}`));
  await page.goto(origin + '/a-url-that-does-not-exist', { waitUntil: 'load' });
  const homeLink = await page.evaluate(() => !!document.querySelector('a[href="/"], a[href="/index.html"]'));
  if (errs.length) note('404', errs[0]);
  if (!homeLink) note('404', 'no link back to the home page');
  await page.close();
} else {
  note('404', 'dist/404.html missing — unknown URLs will show Cloudflare\'s default page');
}

await browser.close();
server.close();

if (problems.length === 0) {
  console.log(`PASS — no issues found. Screenshots: ${shotDir}/`);
} else {
  console.log(`${problems.length} issue(s) found:\n`);
  for (const p of problems) console.log(`  - ${p}`);
  console.log(`\nScreenshots: ${shotDir}/`);
  process.exitCode = 1;
}
