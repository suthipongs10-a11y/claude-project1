#!/usr/bin/env node
// Assemble a site folder into a deploy-ready dist/ plus a review preview.
//
//   dist/index.html    the default language
//   dist/<path>/       one folder per extra language (e.g. dist/en/)
//   dist/404.html      Cloudflare Pages serves this for unknown paths
//   dist/img/          responsive photo derivatives
//   dist/favicon.svg   copied from src/
//   dist/robots.txt    generated from site.json
//   dist/sitemap.xml   every language URL, when a real domain is set
//   dist/_headers      Cloudflare Pages security + cache headers
//   preview.html       (site root, NOT shipped) artifact-ready fragment for
//                      client review — the artifact runtime supplies its own
//                      doctype/head/body wrapper
//
// Deploy dist/ and nothing else: src/ and preview.html must never be public.
//
// src/ contract: head.html (meta only, no <style>; may use {{SITE_URL}} and
//                {{HREFLANG}}), fonts.css (generated), styles.css, body.html,
//                favicon.svg, img/*.webp masters
// site.json:     { "domain", "name", "lang", "languages"? }
//                languages: [{ code, path, label }] — omit for a single-
//                language site. The entry with path "" is the root page.
//
// Usage: node tools/build-site.mjs <site-dir>
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { buildDerivatives, inlineMap, applyImages, listImages, WIDTHS } from './images.mjs';
import { localize, checkTokens, hreflangTags, applyLangLinks } from './i18n.mjs';

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
const langs = cfg.languages ?? [{ code: defaultLang, path: '', label: defaultLang.toUpperCase() }];
if (!langs.some(l => l.path === '')) {
  console.error('site.json: exactly one language must have "path": "" — it is the root page');
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

// Without a real domain, drop the lines that need one outright — an empty
// canonical or og:url is worse than none.
const headFor = lang => {
  const prefix = lang.path ? `/${lang.path}/` : '/';
  return localize(rawHead, lang.code, langs)
    .split('\n')
    .filter(line => siteUrl || !line.includes('{{SITE_URL}}'))
    .join('\n')
    .replaceAll('{{SITE_URL}}', `${siteUrl}${prefix === '/' ? '' : prefix.slice(0, -1)}`)
    .replace('{{HREFLANG}}', hreflangTags(langs, siteUrl, defaultLang))
    .trim();
};

const css = `${src('fonts.css').trim()}\n${src('styles.css').trim()}`;

const dist = join(dir, 'dist');
// dist/img is expensive to regenerate, so it survives the wipe and the
// pipeline decides per-file what is stale
for (const entry of ['index.html', '404.html', 'favicon.svg', 'robots.txt', 'sitemap.xml', '_headers']) {
  rmSync(join(dist, entry), { force: true });
}
for (const l of langs) if (l.path) rmSync(join(dist, l.path), { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const photos = await buildDerivatives(dir, dist);

const pages = [];
for (const lang of langs) {
  const outDir = lang.path ? join(dist, lang.path) : dist;
  mkdirSync(outDir, { recursive: true });
  const bodyHtml = applyImages(applyLangLinks(localize(rawBody, lang.code, langs), langs));
  const file = join(outDir, 'index.html');
  writeFileSync(
    file,
    `<!doctype html>
<html lang="${lang.code}">
<head>
${headFor(lang)}
<style>
${css}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`
  );
  pages.push({ lang, file, url: `/${lang.path ? lang.path + '/' : ''}` });
}

copyFileSync(join(dir, 'src', 'favicon.svg'), join(dist, 'favicon.svg'));

// 404 deliberately skips the embedded font payload — it would double the
// deploy size for a page almost nobody reaches. System faces are fine.
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
  const entries = pages
    .map(p => `  <url><loc>${siteUrl}${p.url}</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>`)
    .join('\n');
  writeFileSync(
    join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
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

// One preview per language: an artifact is a single page with no siblings, so
// the switcher's href cannot resolve there. Publish each file as its own
// artifact and send the client both links.
const inline = await inlineMap(dir);
const previews = [];
for (const lang of langs) {
  const name = lang.code === defaultLang ? 'preview.html' : `preview-${lang.code}.html`;
  const pHead = headFor(lang);
  const pTitle = pHead.match(/<title>([^<]*)<\/title>/)?.[1] ?? 'Preview';
  const pBody = applyImages(applyLangLinks(localize(rawBody, lang.code, langs), langs), { inline });
  writeFileSync(join(dir, name), `<title>${pTitle}</title>\n<style>\n${css}\n</style>\n${pBody}\n`);
  previews.push(name);
}

const kb = n => `${(n / 1024).toFixed(0)} KB`;
console.log(`built ${dist}/`);
for (const p of pages) {
  console.log(`  ${p.url.padEnd(12)} ${p.lang.code}  ${kb(readFileSync(p.file).length)}`);
}
console.log(`  img/         ${photos.count} photo(s) x ${WIDTH_LABEL} = ${kb(photos.bytes)}`);
console.log(`  + 404.html, favicon.svg, robots.txt, _headers${isReal ? ', sitemap.xml' : ''}`);
if (!isReal) console.log(`  note: site.json has no real domain yet — sitemap/hreflang/canonical skipped`);
for (const name of previews) {
  console.log(`${name.padEnd(16)} ${kb(readFileSync(join(dir, name)).length)} (site root, do not deploy)`);
}
if (listImages(dir).length === 0) console.log(`  note: no masters in src/img/ — {{img:...}} placeholders would fail`);
