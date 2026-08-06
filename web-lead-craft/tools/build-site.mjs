#!/usr/bin/env node
// Assemble a site folder into a deploy-ready dist/ plus a review preview.
//
// Two shapes, chosen by whether src/pages/ exists:
//
//   single page   src/body.html is the whole site       → dist/index.html
//                 src/privacy.html, if present          → dist/privacy.html
//   multi page    src/pages/*.html + src/partials/      → dist/<slug>.html
//                 src/articles/*.html                   → dist/articles/<slug>.html
//
// A one-page site still gets its privacy notice as a real page: PDPA wants one
// wherever a form collects personal data, and a legal page is a utility, not a
// second page of content — "เว็บไซต์ 1 หน้า" still holds.
//
// Both emit every configured language into the same file and switch between
// them in the page, so a built site works with no server at all — assets and
// links are relative, resolved through {{BASE}} for the extra depth of an
// article. Flat .html output rather than folder/index.html is what makes that
// true: a directory URL has no index to serve off disk.
//
// Also written: 404.html, favicon.svg, robots.txt, _headers, and sitemap.xml
// once site.json carries a real domain.
//
// Deploy dist/ and nothing else: src/ and preview.html must never be public.
//
// Usage: node tools/build-site.mjs <site-dir>
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { buildDerivatives, inlineMap, applyImages, listImages, WIDTHS } from './images.mjs';
import { localize, checkTokens, expandAll, switcherFor } from './i18n.mjs';
import {
  hasPages, collectPages, collectArticles, baseFor, parseFront,
  renderNav, renderArticleCards, renderBreadcrumb, fmtDate,
} from './pages.mjs';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: build-site.mjs <site-dir>');
  process.exit(1);
}
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

const src = f => readFileSync(join(dir, 'src', f), 'utf8');
const srcIf = f => (existsSync(join(dir, 'src', f)) ? src(f) : '');
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

const multi = hasPages(dir);
const pages = multi ? collectPages(dir) : [];
const articles = multi ? collectArticles(dir) : [];
// The one extra page a single-page site may carry, kept deliberately to one:
// anything more is the multi-page shape and should say so with src/pages/.
const legalFile = !multi && existsSync(join(dir, 'src', 'privacy.html')) ? 'privacy.html' : null;
const css = `${src('fonts.css').trim()}\n${src('styles.css').trim()}`;
const rawHead = src('head.html');

// A token missing a phrase would silently ship an empty heading, so refuse to
// build rather than emit one.
const sources = multi
  ? [
      ['head.html', rawHead],
      ['partials/header.html', srcIf('partials/header.html')],
      ['partials/footer.html', srcIf('partials/footer.html')],
      ['partials/article.html', srcIf('partials/article.html')],
      ...pages.map(p => [`pages/${p.file}`, `${p.title}${p.desc}${p.nav ?? ''}${p.body}`]),
      ...articles.map(a => [`articles/${a.file}`, `${a.title}${a.desc}${a.cat}${a.body}`]),
    ]
  : [
      ['head.html', rawHead],
      ['body.html', src('body.html')],
      ...(legalFile ? [[legalFile, src(legalFile)]] : []),
    ];
const tokenProblems = sources.flatMap(([where, text]) => checkTokens(text, langs, where));
if (tokenProblems.length) {
  console.error(`translation tokens are malformed:\n  ${tokenProblems.join('\n  ')}`);
  process.exit(1);
}

const dist = join(dir, 'dist');
// dist/img is expensive to regenerate, so it survives the wipe and the
// pipeline decides per-file what is stale
for (const entry of ['404.html', 'favicon.svg', 'robots.txt', 'sitemap.xml', '_headers', 'articles', 'privacy.html']) {
  rmSync(join(dist, entry), { recursive: true, force: true });
}
for (const f of existsSync(dist) ? [] : []) rmSync(f, { force: true });
mkdirSync(dist, { recursive: true });
for (const p of multi ? pages : [{ out: 'index.html' }]) rmSync(join(dist, p.out), { force: true });

const photos = await buildDerivatives(dir, dist);

/** A single-page head serves a second page once its four title/description
 *  tags are swapped. Function replacements keep `$` in Thai copy literal. */
function headWith(head, title, desc) {
  let out = head.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${title}</title>`);
  const tags = [['name="description"', desc], ['property="og:title"', title], ['property="og:description"', desc]];
  for (const [sel, value] of tags) {
    out = out.replace(new RegExp(`(<meta ${sel} content=")[^"]*(")`), (_m, a, b) => a + value + b);
  }
  return out;
}

/** Head for one page: shared meta plus this page's title, description, canonical. */
function headFor(lang, page, base) {
  const path = page.out === 'index.html' ? '/' : `/${page.out}`;
  return localize(page.head ?? rawHead, lang, langs)
    .replaceAll('{{PAGE_TITLE}}', localize(page.title, lang, langs))
    .replaceAll('{{PAGE_DESC}}', localize(page.desc, lang, langs))
    .replaceAll('{{BASE}}', base)
    .split('\n')
    .filter(line => siteUrl || !line.includes('{{SITE_URL}}'))
    .join('\n')
    .replaceAll('{{SITE_URL}}', `${siteUrl}${path}`)
    .trim();
}

/** The per-page dictionary the language switch reads. */
const metaFor = page =>
  Object.fromEntries(
    langs.map(l => [l.code, {
      title: localize(page.title, l.code, langs),
      desc: localize(page.desc, l.code, langs),
    }])
  );

function langScriptFor(meta, nodes) {
  if (langs.length < 2) return '';
  const payload = JSON.stringify({ default: defaultLang, meta, nodes }).replaceAll('</', '<\\/');
  return `
<script type="application/json" id="i18n-data">${payload}</script>
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
}

/** Render one page to disk and hand back what the sitemap needs. */
function emit(page, bodyHtml, base) {
  const withSwitcher = bodyHtml.replaceAll('{{SWITCHER}}', switcherFor(langs, defaultLang));
  const { html, data } = expandAll(withSwitcher, langs, defaultLang);
  const out = join(dist, page.out);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    `<!doctype html>
<html lang="${defaultLang}" data-lang="${defaultLang}">
<head>
${headFor(defaultLang, page, base)}
<style>
${css}
</style>
</head>
<body>
${applyImages(html, { base })}${langScriptFor(metaFor(page), data)}
</body>
</html>
`
  );
  return { out: page.out, bytes: readFileSync(out).length, expanded: withSwitcher };
}

const written = [];
let previewSource = null;

if (multi) {
  const header = srcIf('partials/header.html');
  const footer = srcIf('partials/footer.html');
  const articleTpl = srcIf('partials/article.html');

  for (const page of pages) {
    const base = baseFor(page.out);
    const trail = page.slug === 'index' ? [] : [
      { label: '{{t|หน้าแรก|Home}}', href: 'index.html' },
      { label: page.nav ?? page.title },
    ];
    const body = `${header}\n${page.body}\n${footer}`
      .replaceAll('{{NAV}}', renderNav(pages, page.slug, base))
      .replaceAll('{{BREADCRUMB}}', renderBreadcrumb(trail, base))
      .replace(/\{\{ARTICLES(?::(\d+))?\}\}/g, (_m, n) => renderArticleCards(articles, base, Number(n) || 0))
      .replaceAll('{{BASE}}', base);
    written.push(emit(page, body, base));
    if (page.slug === 'index') previewSource = written[written.length - 1].expanded;
  }

  for (const a of articles) {
    const base = baseFor(a.out);
    const blog = pages.find(p => p.slug === 'blog');
    const trail = [
      { label: '{{t|หน้าแรก|Home}}', href: 'index.html' },
      ...(blog ? [{ label: blog.nav, href: blog.href }] : []),
      { label: a.title },
    ];
    const related = articles.filter(x => x.slug !== a.slug).slice(0, 3);
    const body = `${header}\n${articleTpl}\n${footer}`
      .replaceAll('{{NAV}}', renderNav(pages, 'blog', base))
      .replaceAll('{{BREADCRUMB}}', renderBreadcrumb(trail, base))
      .replaceAll('{{ARTICLE_TITLE}}', a.title)
      .replaceAll('{{ARTICLE_DESC}}', a.desc)
      .replaceAll('{{ARTICLE_CAT}}', a.cat)
      .replaceAll('{{ARTICLE_DATE_ISO}}', a.date)
      .replaceAll('{{ARTICLE_DATE}}', fmtDate(a.date))
      .replaceAll('{{ARTICLE_READ}}', a.read)
      .replaceAll('{{ARTICLE_HERO}}', a.img)
      .replaceAll('{{ARTICLE_BODY}}', a.body)
      .replaceAll('{{RELATED}}', renderArticleCards(related, base, 3))
      .replaceAll('{{BASE}}', base);
    written.push(emit(a, body, base));
  }
} else {
  const page = { out: 'index.html', slug: 'index', title: '', desc: '' };
  // A single-page site keeps its title and description in head.html directly.
  const h = rawHead;
  page.title = h.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
  page.desc = h.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
  const rec = emit(page, src('body.html').trim(), '');
  written.push(rec);
  previewSource = rec.expanded;

  if (legalFile) {
    const { meta, body } = parseFront(src(legalFile));
    const legal = {
      out: legalFile,
      slug: legalFile.replace(/\.html$/, ''),
      title: meta.title ?? '',
      desc: meta.desc ?? '',
    };
    legal.head = headWith(rawHead, legal.title, legal.desc);
    written.push(emit(legal, body, ''));
  }
}

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
  const urls = written
    .map(w => `  <url><loc>${siteUrl}/${w.out === 'index.html' ? '' : w.out}</loc><changefreq>monthly</changefreq></url>`)
    .join('\n');
  writeFileSync(
    join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
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

// The preview is the home page only — an artifact is one page, and links to
// the site's other pages have nowhere to go there.
const home = multi ? pages.find(p => p.slug === 'index') : { title: written[0] ? '' : '', desc: '' };
const previewMeta = multi ? metaFor(home) : null;
const { html: previewHtml, data: previewNodes } = expandAll(previewSource, langs, defaultLang);
const previewTitle = multi ? previewMeta[defaultLang].title : (rawHead.match(/<title>([^<]*)<\/title>/)?.[1] ?? 'Preview');
writeFileSync(
  join(dir, 'preview.html'),
  `<title>${localize(previewTitle, defaultLang, langs)}</title>\n<style>\n${css}\n</style>\n` +
    `${applyImages(previewHtml, { inline: await inlineMap(dir) })}` +
    `${langScriptFor(multi ? previewMeta : metaFor({ title: previewTitle, desc: '' }), previewNodes)}\n`
);

const kb = n => `${(n / 1024).toFixed(0)} KB`;
console.log(`built ${dist}/  (${langs.map(l => l.code).join(' + ')})`);
for (const w of written) console.log(`  ${w.out.padEnd(34)} ${kb(w.bytes)}`);
console.log(`  img/${' '.repeat(30)} ${photos.count} photo(s) x ${WIDTHS.join('/')} = ${kb(photos.bytes)}`);
console.log(`  + 404.html, favicon.svg, robots.txt, _headers${isReal ? ', sitemap.xml' : ''}`);
if (!isReal) console.log(`  note: site.json has no real domain yet — sitemap/canonical skipped`);
console.log(`preview.html ${kb(readFileSync(join(dir, 'preview.html')).length)} (site root, do not deploy)`);
if (listImages(dir).length === 0) console.log(`  note: no masters in src/img/ — {{img:...}} placeholders would fail`);
