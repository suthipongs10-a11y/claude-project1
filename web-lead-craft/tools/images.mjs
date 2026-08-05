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
import { readdirSync, existsSync, statSync, mkdirSync, readFileSync } from 'node:fs';
import { join, parse } from 'node:path';

export const WIDTHS = [480, 800, 1200];
const PREVIEW_WIDTH = 800; // inlined into preview.html — the artifact cap is
                           // 16MB, so favour fidelity for client review
const QUALITY = 78;

const srcDir = dir => join(dir, 'src', 'img');

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

  let bytes = 0;
  for (const name of names) {
    const master = join(srcDir(dir), `${name}.webp`);
    const meta = await sharp(master).metadata();
    for (const w of WIDTHS) {
      // never upscale past the master
      if (w > meta.width) continue;
      const out = join(outDir, `${name}-${w}.webp`);
      if (existsSync(out) && statSync(out).mtimeMs >= statSync(master).mtimeMs) {
        bytes += statSync(out).size;
        continue;
      }
      const info = await sharp(master).resize({ width: w }).webp({ quality: QUALITY }).toFile(out);
      bytes += info.size;
    }
  }
  return { count: names.length, bytes };
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
export function applyImages(html, { inline = null, sizesDefault = '100vw' } = {}) {
  return html.replace(/\{\{img:([a-z0-9-]+)(?::([^}]+))?\}\}/g, (_m, name, sizes) => {
    if (inline) {
      const uri = inline.get(name);
      if (!uri) throw new Error(`no image master named "${name}" — check src/img/`);
      return `src="${uri}"`;
    }
    // Relative, not root-absolute: the built page must also work when opened
    // straight off disk, where "/img/…" would resolve to the drive root.
    const set = WIDTHS.map(w => `img/${name}-${w}.webp ${w}w`).join(', ');
    return `src="img/${name}-1200.webp" srcset="${set}" sizes="${sizes || sizesDefault}"`;
  });
}

export const readMaster = (dir, name) => readFileSync(join(srcDir(dir), `${name}.webp`));
