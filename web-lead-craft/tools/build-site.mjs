#!/usr/bin/env node
// Assemble a site folder from its src/ parts into two outputs:
//   index.html   — the deliverable: full standalone document (deploy this)
//   preview.html — same page without the outer skeleton, for publishing as a
//                  claude.ai artifact during client review (the artifact
//                  runtime supplies its own doctype/head/body wrapper)
//
// src/ contract: head.html (meta only, no <style>), fonts.css (generated),
//                styles.css, body.html (markup + inline <script>)
//
// Usage: node tools/build-site.mjs <site-dir>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: build-site.mjs <site-dir>');
  process.exit(1);
}
const src = f => readFileSync(join(dir, 'src', f), 'utf8');
const head = src('head.html').trim();
const css = `${src('fonts.css').trim()}\n${src('styles.css').trim()}`;
const body = src('body.html').trim();

writeFileSync(
  join(dir, 'index.html'),
  `<!doctype html>
<html lang="th">
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

const title = head.match(/<title>([^<]*)<\/title>/)?.[1] ?? 'Preview';
writeFileSync(join(dir, 'preview.html'), `<title>${title}</title>\n<style>\n${css}\n</style>\n${body}\n`);
console.log(`built ${join(dir, 'index.html')} + preview.html`);
