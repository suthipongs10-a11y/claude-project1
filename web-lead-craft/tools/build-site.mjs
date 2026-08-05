#!/usr/bin/env node
// Assemble a site folder into a deploy-ready dist/ plus a review preview.
//
//   dist/index.html   the page — one self-contained file, no external requests
//   dist/404.html     Cloudflare Pages serves this for unknown paths
//   dist/favicon.svg  copied from src/
//   dist/robots.txt   generated from site.json
//   dist/sitemap.xml  generated from site.json
//   dist/_headers     Cloudflare Pages security headers
//   preview.html      (site root, NOT shipped) artifact-ready fragment for
//                     client review — the artifact runtime supplies its own
//                     doctype/head/body wrapper
//
// Deploy dist/ and nothing else: src/ and preview.html must never be public.
//
// src/ contract: head.html (meta only, no <style>; may use {{SITE_URL}}),
//                fonts.css (generated), styles.css, body.html, favicon.svg
// site.json:     { "domain": "example.com", "name": "...", "lang": "th" }
//
// Usage: node tools/build-site.mjs <site-dir>
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: build-site.mjs <site-dir>');
  process.exit(1);
}

const src = f => readFileSync(join(dir, 'src', f), 'utf8');
const cfgPath = join(dir, 'site.json');
if (!existsSync(cfgPath)) {
  console.error(`missing ${cfgPath} — see another site folder for the shape`);
  process.exit(1);
}
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const lang = cfg.lang ?? 'th';
// Placeholder domains stay out of robots/sitemap: pointing crawlers at a
// domain we do not own is worse than shipping no sitemap at all.
const isReal = typeof cfg.domain === 'string' && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(cfg.domain) && !cfg.domain.startsWith('example.');
const siteUrl = isReal ? `https://${cfg.domain}` : '';

// Without a real domain, drop the lines that need one outright — an empty
// canonical or og:url is worse than none.
const head = src('head.html')
  .split('\n')
  .filter(line => siteUrl || !line.includes('{{SITE_URL}}'))
  .join('\n')
  .replaceAll('{{SITE_URL}}', siteUrl)
  .trim();
const css = `${src('fonts.css').trim()}\n${src('styles.css').trim()}`;
const body = src('body.html').trim();

const dist = join(dir, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

writeFileSync(
  join(dist, 'index.html'),
  `<!doctype html>
<html lang="${lang}">
<head>
${head}
<style>
${css}
</style>
</head>
<body>
${body}
</body>
</html>
`
);

copyFileSync(join(dir, 'src', 'favicon.svg'), join(dist, 'favicon.svg'));

// 404 deliberately skips the embedded font payload — it would double the
// deploy size for a page almost nobody reaches. System Thai faces are fine.
writeFileSync(
  join(dist, '404.html'),
  `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>ไม่พบหน้านี้ — ${cfg.name}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
*{box-sizing:border-box;margin:0}
body{min-height:100vh;display:grid;place-items:center;padding:32px;text-align:center;
  font-family:-apple-system,'Segoe UI','Leelawadee UI','Noto Sans Thai',sans-serif;
  line-height:1.8;color:#4A6B74;background:#F1F8F9}
main{display:grid;gap:18px;justify-items:center;max-width:30em}
b{font-size:4rem;line-height:1;color:#0B7E8A}
h1{font-size:1.5rem;color:#143C44}
a{display:inline-block;margin-top:6px;background:#0B7E8A;color:#fff;text-decoration:none;
  font-weight:600;padding:13px 30px;border-radius:999px}
a:hover{background:#096C77}
</style>
</head>
<body>
<main>
  <b>404</b>
  <h1>ไม่พบหน้าที่คุณกำลังมองหา</h1>
  <p>หน้านี้อาจถูกย้ายหรือลบไปแล้ว กลับไปหน้าแรกเพื่อดูบริการและจองคิวได้เลย</p>
  <a href="/">กลับหน้าแรก</a>
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

writeFileSync(
  join(dist, '_headers'),
  `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=(), interest-cohort=()

/favicon.svg
  Cache-Control: public, max-age=604800
`
);

const title = head.match(/<title>([^<]*)<\/title>/)?.[1] ?? 'Preview';
writeFileSync(join(dir, 'preview.html'), `<title>${title}</title>\n<style>\n${css}\n</style>\n${body}\n`);

const kb = n => `${(n / 1024).toFixed(0)} KB`;
console.log(`built ${dist}/`);
console.log(`  index.html   ${kb(readFileSync(join(dist, 'index.html')).length)}`);
console.log(`  + 404.html, favicon.svg, robots.txt, _headers${isReal ? ', sitemap.xml' : ''}`);
if (!isReal) console.log(`  note: site.json has no real domain yet — sitemap skipped, canonical/og:url left empty`);
console.log(`preview.html written to site root (do not deploy)`);
