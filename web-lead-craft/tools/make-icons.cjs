// Usage: node tools/make-icons.cjs <logo.png|webp> <site>/src
//   writes favicon.svg, favicon.ico (16/32/48) and apple-touch-icon.png (180, white ground)
// Build the site icons from the company's butterfly logo.
const sharp = require('sharp'); const fs = require('fs'); const path = require('path');
const [src, outDir] = process.argv.slice(2);
(async () => {
  const trimmed = await sharp(src).trim().png().toBuffer();
  const m = await sharp(trimmed).metadata();
  // square canvas, butterfly centred; the logo already reaches its own edges and is a thin diagonal shape, so any added margin only makes it smaller in a 16px tab
  const side = Math.round(Math.max(m.width, m.height));
  const square = await sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: trimmed, gravity: 'center' }]).png().toBuffer();
  const at = n => sharp(square).resize(n, n, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer();
  // SVG wrapper around a 128px raster: one file the build already copies
  const p128 = await at(128);
  fs.writeFileSync(path.join(outDir, 'favicon.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image width="64" height="64" href="data:image/png;base64,${p128.toString('base64')}"/></svg>\n`);
  // ICO with PNG entries (16/32/48), what Safari and /favicon.ico requests get
  const sizes = [16, 32, 48]; const pngs = await Promise.all(sizes.map(at));
  const head = Buffer.alloc(6 + 16 * sizes.length); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  let off = head.length;
  sizes.forEach((s, i) => { const e = 6 + 16 * i; head[e] = s; head[e + 1] = s; head[e + 2] = 0; head[e + 3] = 0;
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6); head.writeUInt32LE(pngs[i].length, e + 8); head.writeUInt32LE(off, e + 12); off += pngs[i].length; });
  fs.writeFileSync(path.join(outDir, 'favicon.ico'), Buffer.concat([head, ...pngs]));
  // iOS home screen: opaque (iOS paints transparency black), with breathing room
  const inner = await sharp(square).resize(148, 148).png().toBuffer();
  await sharp({ create: { width: 180, height: 180, channels: 3, background: '#FFFFFF' } })
    .composite([{ input: inner, gravity: 'center' }]).png({ compressionLevel: 9 }).toFile(path.join(outDir, 'apple-touch-icon.png'));
  console.log('trimmed', m.width + 'x' + m.height, '-> square', side);
})();
