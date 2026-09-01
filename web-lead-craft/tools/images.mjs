// Shared image pipeline. Masters live in <site>/src/img/*.webp at full
// resolution and are the committed source of truth; everything below is
// derived build output.
//
// Photos are the one thing on these pages that cannot be inlined into the
// HTML: a data URI cannot be lazy-loaded, cannot be cached separately, and
// cannot be served at a size matched to the viewport. So dist/ gets real
// image files with a srcset, and only the artifact preview inlines them
// (an artifact is a single page — it has no sibling files to link to).
import sharp from 'sharp';
import { readdirSync, existsSync, statSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, parse } from 'node:path';

export const WIDTHS = [480, 800, 1200];

/**
 * The widths worth deriving from a master this wide.
 *
 * The standard steps, minus any that would upscale — plus the master's own
 * width when it falls between two steps, so a 720px phone photo is still
 * served at 720 rather than dropping to 480 and looking soft. Both the
 * derivative writer and the markup rewriter call this, so they cannot
 * disagree about which files exist.
 */
export function availableWidths(masterWidth) {
  const fit = WIDTHS.filter(w => w <= masterWidth);
  const largest = fit[fit.length - 1];
  if (masterWidth < WIDTHS[WIDTHS.length - 1] && masterWidth !== largest) fit.push(masterWidth);
  return fit.length ? fit : [masterWidth];
}
const PREVIEW_WIDTH = 800; // inlined into preview.html — the artifact cap is
                           // 16MB, so favour fidelity for client review
const QUALITY = 78;

const srcDir = dir => join(dir, 'src', 'img');

/**
 * The derivative widths that exist for each master, keyed by name.
 *
 * buildDerivatives() refuses to upscale, so a master narrower than 1200px
 * has no 1200 file — and a srcset naming one, or worse a `src` pointing at
 * one, is a broken image on the page. This map is what keeps the markup
 * honest about which files were actually written.
 */
export async function widthsFor(dir) {
  const map = new Map();
  for (const name of listImages(dir)) {
    const meta = await sharp(join(srcDir(dir), `${name}.webp`)).metadata();
    map.set(name, availableWidths(meta.width));
  }
  return map;
}

export function listImages(dir) {
  const d = srcDir(dir);
  if (!existsSync(d)) return [];
  return readdirSync(d).filter(f => f.endsWith('.webp')).map(f => parse(f).name).sort();
}

/** Write every derivative into <dist>/img/. Skips work already up to date. */
export async function buildDerivatives(dir, dist) {
  const names = listImages(dir);
  if (names.length === 0) return { count: 0, bytes: 0 };
  const outDir = join(dist, 'img');
  mkdirSync(outDir, { recursive: true });

  // dist/img survives build-site's wipe because regenerating it is expensive,
  // so a derivative whose master has been deleted would otherwise live on in
  // the deploy folder forever — shipping a photo the site no longer shows.
  const wanted = new Set();

  let bytes = 0;
  for (const name of names) {
    const master = join(srcDir(dir), `${name}.webp`);
    const meta = await sharp(master).metadata();
    for (const w of availableWidths(meta.width)) {
      const out = join(outDir, `${name}-${w}.webp`);
      if (existsSync(out) && statSync(out).mtimeMs >= statSync(master).mtimeMs) {
        bytes += statSync(out).size;
        continue;
      }
      const info = await sharp(master).resize({ width: w }).webp({ quality: QUALITY }).toFile(out);
      bytes += info.size;
    }
    for (const w of availableWidths(meta.width)) wanted.add(`${name}-${w}.webp`);
  }

  let pruned = 0;
  for (const f of readdirSync(outDir)) {
    if (f.endsWith('.webp') && !wanted.has(f)) {
      rmSync(join(outDir, f), { force: true });
      pruned++;
    }
  }
  return { count: names.length, bytes, pruned };
}

/** name -> data URI at PREVIEW_WIDTH, for inlining into preview.html. */
export async function inlineMap(dir) {
  const map = new Map();
  for (const name of listImages(dir)) {
    const buf = await sharp(join(srcDir(dir), `${name}.webp`))
      .resize({ width: PREVIEW_WIDTH })
      .webp({ quality: 70 })
      .toBuffer();
    map.set(name, `data:image/webp;base64,${buf.toString('base64')}`);
  }
  return map;
}

/**
 * Rewrite the {{img:name}} placeholders authored in body.html.
 *
 * For dist: src points at the largest derivative and srcset offers all of
 * them, so a phone downloads the 480 and a desktop the 1200.
 * For preview: a single inlined data URI, and srcset/sizes are dropped
 * because there is nothing else to choose between.
 */
export function applyImages(html, { inline = null, sizesDefault = '100vw', base = '', widths = null } = {}) {
  return html.replace(/\{\{img:([a-z0-9-]+)(?::([^}]+))?\}\}/g, (_m, name, sizes) => {
    if (inline) {
      const uri = inline.get(name);
      if (!uri) throw new Error(`no image master named "${name}" — check src/img/`);
      return `src="${uri}"`;
    }
    // Relative, not root-absolute: the built page must also work when opened
    // straight off disk, where "/img/…" would resolve to the drive root. `base`
    // carries the extra depth of a page in a subfolder — without it an article
    // asks for /articles/img/… and gets a 404.
    const avail = widths?.get(name) ?? WIDTHS;
    if (avail.length === 0) throw new Error(`no derivatives for image "${name}" — is src/img/${name}.webp readable?`);
    const largest = avail[avail.length - 1];
    const set = avail.map(w => `${base}img/${name}-${w}.webp ${w}w`).join(', ');
    return `src="${base}img/${name}-${largest}.webp" srcset="${set}" sizes="${sizes || sizesDefault}"`;
  });
}

export const readMaster = (dir, name) => readFileSync(join(srcDir(dir), `${name}.webp`));
