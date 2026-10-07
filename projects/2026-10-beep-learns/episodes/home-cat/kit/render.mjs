// MOTION STUDIO renderer: headless Chromium screenshots each frame -> ffmpeg.
// node kit/render.mjs stills <w> <h> t1 t2 ...        -> stills/*.jpg + stills/sheet.jpg
// node kit/render.mjs video  <w> <h> <start> <end>    -> video_noaudio.mp4
// node kit/render.mjs final  <w> <h> <out.mp4>        -> mux video_noaudio.mp4 + score.wav (CRF 22, faststart)
import { createRequire } from 'module';
import { spawn, execFileSync } from 'child_process';
import http from 'http'; import fs from 'fs'; import path from 'path';
const { chromium } = createRequire(path.join(process.cwd(), 'x.js'))('playwright');
const [mode, W = '1920', H = '1080', ...rest] = process.argv.slice(2);
if (mode === 'final') { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', 'video_noaudio.mp4', '-i', 'score.wav', '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', rest[0] || 'final.mp4']); console.log('wrote', rest[0] || 'final.mp4'); process.exit(0); }
const root = process.cwd();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); } }); }).listen(0);
const port = srv.address().port;
const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: +W, height: +H } });
page.on('pageerror', e => console.error('PAGE ERROR:', e.message));
await page.goto(`http://localhost:${port}/film.html?w=${W}&h=${H}`); await page.evaluate(() => window.ready);
if (mode === 'stills') {
  fs.rmSync('stills', { recursive: true, force: true }); fs.mkdirSync('stills');
  for (const t of rest.map(Number)) { await page.evaluate(t => seek(t), t); await page.screenshot({ path: `stills/t${t.toFixed(2).padStart(6, '0')}.jpg`, type: 'jpeg', quality: 80 }); }
  const cols = +W > +H ? 4 : 6, tw = +W > +H ? 480 : 270, th = Math.round(tw * +H / +W);
  try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-pattern_type', 'glob', '-i', 'stills/t*.jpg', '-vf', `scale=${tw}:${th},drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:text='%{n}':x=6:y=6:fontsize=18:fontcolor=red,tile=${cols}x${Math.ceil(rest.length / cols)}`, '-frames:v', '1', 'stills/sheet.jpg']); } catch (e) { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-pattern_type', 'glob', '-i', 'stills/t*.jpg', '-vf', `scale=${tw}:${th},tile=${cols}x${Math.ceil(rest.length / cols)}`, '-frames:v', '1', 'stills/sheet.jpg']); }
  console.log('stills/sheet.jpg');
} else {
  const fps = 30, start = +(rest[0] || 0), end = +(rest[1] || 60);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', 'video_noaudio.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
  const N = Math.round((end - start) * fps), t0 = Date.now();
  for (let i = 0; i < N; i++) { await page.evaluate(t => seek(t), start + i / fps); const b = await page.screenshot({ type: 'jpeg', quality: 95 }); if (!ff.stdin.write(b)) await new Promise(r => ff.stdin.once('drain', r)); if (i % 300 === 0) console.log(`${i}/${N} frames ${((Date.now() - t0) / 1000).toFixed(0)}s`); }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log('video_noaudio.mp4 done');
}
await browser.close(); srv.close();
