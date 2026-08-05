#!/usr/bin/env node
// Assemble a site folder into a deploy-ready dist/ plus a review preview.
//
//   dist/index.html    the page — every language in one file
//   dist/404.html      Cloudflare Pages serves this for unknown paths
//   dist/img/          responsive photo derivatives
//   dist/favicon.svg   copied from src/
//   dist/robots.txt    generated from site.json
//   dist/sitemap.xml   generated when site.json carries a real domain
//   dist/_headers      Cloudflare Pages security + cache headers
//   preview.html       (site root, NOT shipped, gitignored) artifact-ready
//                      fragment — the artifact runtime supplies its own
//                      doctype/head/body wrapper
//
// Deploy dist/ and nothing else: src/ and preview.html must never be public.
//
// Everything inside dist/index.html links to its assets with relative paths,
// so the built page opens correctly by double-click as well as over HTTP.
//
// src/ contract: head.html (meta only, no <style>; may use {{SITE_URL}}),
//                fonts.css (generated), styles.css, body.html, favicon.svg,
//                img/*.webp masters
// site.json:     { "domain", "name", "lang", "languages"? }
//                languages: [{ code, label }] — omit for a single-language
//                site. `lang` names the one shown before the visitor chooses.
//
// Usage: node tools/build-site.mjs <site-dir>
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { buildDerivatives, inlineMap, applyImages, listImages, WIDTHS } from './images.mjs';
import { localize, checkTokens, expandAll, switcherFor } from './i18n.mjs';

const WIDTH_LABEL = WIDTHS.join('/');

const dir = process.argv[2];
if (!dir) {
  console.error('usage: build-site.mjs <site-dir>');
  process.exit(1);
}

const src = f => readFileSync(join(dir, 'src', f), 'utf8');
if (!existsSync(dir)) {
  console.error(`no site folder at ${dir}`);
  console.error(`if you expected one, the last "git pull" may not have completed — check "git status"`);
  process.exit(1);
}
const cfgPath = join(dir, 'site.json');
if (!existsSync(cfgPath)) {
  console.error(`missing ${cfgPath} — see another site folder for the shape`);
  process.exit(1);
}
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const defaultLang = cfg.lang ?? 'th';
const langs = cfg.languages ?? [{ code: defaultLang, label: defaultLang.toUpperCase() }];
if (!langs.some(l => l.code === defaultLang)) {
  console.error(`site.json: "lang": "${defaultLang}" is not in the languages list`);
  process.exit(1);
}

// Placeholder domains stay out of robots/sitemap: pointing crawlers at a
// domain we do not own is worse than shipping no sitemap at all.
const isReal = typeof cfg.domain === 'string' && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(cfg.domain) && !cfg.domain.startsWith('example.');
const siteUrl = isReal ? `https://${cfg.domain}` : '';

const rawHead = src('head.html');
const rawBody = src('body.html');

// A token missing a phrase would silently ship an empty heading, so refuse
// to build rather than emit one.
const tokenProblems = [
  ...checkTokens(rawHead, langs, 'head.html'),
  ...checkTokens(rawBody, langs, 'body.html'),
];
if (tokenProblems.length) {
  console.error(`translation tokens are malformed:\n  ${tokenProblems.join('\n  ')}`);
  process.exit(1);
}

// The head ships in the default language; the switch updates <title> and the
// description from the same JSON block the body uses.
const head = localize(rawHead, defaultLang, langs)
  .split('\n')
  .filter(line => siteUrl || !line.includes('{{SITE_URL}}'))
  .join('\n')
  .replaceAll('{{SITE_URL}}', siteUrl)
  .trim();

const meta = Object.fromEntries(
  langs.map(l => {
    const h = localize(rawHead, l.code, langs);
    return [l.code, {
      title: h.match(/<title>([^<]*)<\/title>/)?.[1] ?? '',
      desc: h.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '',
    }];
  })
);

const withSwitcher = rawBody.replaceAll('{{SWITCHER}}', switcherFor(langs, defaultLang));
const { html: expandedBody, data: i18nNodes } = expandAll(withSwitcher, langs, defaultLang);
const css = `${src('fonts.css').trim()}\n${src('styles.css').trim()}`;

const dist = join(dir, 'dist');
// dist/img is expensive to regenerate, so it survives the wipe and the
// pipeline decides per-file what is stale
for (const entry of ['index.html', '404.html', 'favicon.svg', 'robots.txt', 'sitemap.xml', '_headers']) {
  rmSync(join(dist, entry), { force: true });
}
mkdirSync(dist, { recursive: true });

const photos = await buildDerivatives(dir, dist);

// The switch itself. It runs from a JSON island rather than inline strings so
// nothing here needs escaping, and it is small enough to inline everywhere.
const i18nPayload = JSON.stringify({ default: defaultLang, meta, nodes: i18nNodes })
  .replaceAll('</', '<\\/');
const langScript = langs.length < 2 ? '' : `
<script type="application/json" id="i18n-data">${i18nPayload}</script>
<script>
(function () {
  var D = JSON.parse(document.getElementById('i18n-data').textContent);
  var root = document.documentElement;
  function apply(code) {
    if (!D.meta[code]) return;
    root.setAttribute('data-lang', code);
    root.lang = code;
    document.title = D.meta[code].title;
    var desc = document.querySelector('meta[name=description]');
    if (desc) desc.setAttribute('content', D.meta[code].desc);
    for (var key in D.nodes) {
      var el = document.querySelector('[data-ti="' + key + '"]');
      if (!el) continue;
      var entry = D.nodes[key];
      if (entry.text) el.textContent = entry.text[code];
      for (var name in entry.attr || {}) el.setAttribute(name, entry.attr[name][code]);
    }
    document.querySelectorAll('[data-set-lang]').forEach(function (b) {
      if (b.dataset.setLang === code) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
    try { localStorage.setItem('lang', code); } catch (e) {}
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-set-lang]');
    if (!b) return;
    ev.preventDefault();
    apply(b.dataset.setLang);
  });
  // Only an explicit choice is restored. Guessing from navigator.language
  // would put plenty of Thai visitors on the English copy, since English-locale
  // phones are common here — and the business's own language is the safer
  // thing to open with.
  var saved;
  try { saved = localStorage.getItem('lang'); } catch (e) {}
  if (saved && saved !== D.default) apply(saved);
})();
</script>`;

writeFileSync(
  join(dist, 'index.html'),
  `<!doctype html>
<html lang="${defaultLang}" data-lang="${defaultLang}">
<head>
${head}
<style>
${css}
</style>
</head>
<body>
${applyImages(expandedBody)}${langScript}
</body>
</html>
`
);

copyFileSync(join(dir, 'src', 'favicon.svg'), join(dist, 'favicon.svg'));

// 404 deliberately skips the embedded font payload — it would double the
// deploy size for a page almost nobody reaches. System faces are fine.
// Its links stay root-absolute: it is served at URLs of any depth.
const t404 = cfg.notFound ?? {};
writeFileSync(
  join(dist, '404.html'),
  `<!doctype html>
<html lang="${defaultLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${t404.title ?? 'ไม่พบหน้านี้'} — ${cfg.name}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
*{box-sizing:border-box;margin:0}
body{min-height:100vh;display:grid;place-items:center;padding:32px;text-align:center;
  font-family:-apple-system,'Segoe UI','Leelawadee UI','Noto Sans Thai',sans-serif;
  line-height:1.8;color:${t404.body ?? '#4A6B74'};background:${t404.bg ?? '#F1F8F9'}}
main{display:grid;gap:18px;justify-items:center;max-width:30em}
b{font-size:4rem;line-height:1;color:${t404.accent ?? '#0B7E8A'}}
h1{font-size:1.5rem;color:${t404.ink ?? '#143C44'}}
a{display:inline-block;margin-top:6px;background:${t404.accent ?? '#0B7E8A'};color:#fff;text-decoration:none;
  font-weight:600;padding:13px 30px;border-radius:${t404.radius ?? '999px'}}
a:hover{opacity:.9}
</style>
</head>
<body>
<main>
  <b>404</b>
  <h1>${t404.title ?? 'ไม่พบหน้าที่คุณกำลังมองหา'}</h1>
  <p>${t404.text ?? 'หน้านี้อาจถูกย้ายหรือลบไปแล้ว กลับไปหน้าแรกเพื่อดูบริการและจองคิวได้เลย'}</p>
  <a href="/">${t404.cta ?? 'กลับหน้าแรก'}</a>
</main>
</body>
</html>
`
);

writeFileSync(
  join(dist, 'robots.txt'),
  isReal ? `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n` : `User-agent: *\nAllow: /\n`
);

if (isReal) {
  writeFileSync(
    join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${siteUrl}/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>
</urlset>
`
  );
}

// Image filenames carry their width, and a changed photo gets a new master,
// so a long immutable cache on /img is safe. The HTML itself must not be
// cached hard — it is what points at everything else.
writeFileSync(
  join(dist, '_headers'),
  `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=(), interest-cohort=()

/img/*
  Cache-Control: public, max-age=31536000, immutable

/favicon.svg
  Cache-Control: public, max-age=604800
`
);

const previewBody = applyImages(expandedBody, { inline: await inlineMap(dir) });
writeFileSync(
  join(dir, 'preview.html'),
  `<title>${meta[defaultLang].title}</title>\n<style>\n${css}\n</style>\n${previewBody}${langScript}\n`
);

const kb = n => `${(n / 1024).toFixed(0)} KB`;
console.log(`built ${dist}/`);
console.log(`  index.html   ${kb(readFileSync(join(dist, 'index.html')).length)}  (${langs.map(l => l.code).join(' + ')})`);
console.log(`  img/         ${photos.count} photo(s) x ${WIDTH_LABEL} = ${kb(photos.bytes)}`);
console.log(`  + 404.html, favicon.svg, robots.txt, _headers${isReal ? ', sitemap.xml' : ''}`);
if (!isReal) console.log(`  note: site.json has no real domain yet — sitemap/canonical skipped`);
console.log(`preview.html   ${kb(readFileSync(join(dir, 'preview.html')).length)} (site root, do not deploy)`);
if (listImages(dir).length === 0) console.log(`  note: no masters in src/img/ — {{img:...}} placeholders would fail`);
