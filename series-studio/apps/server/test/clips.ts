import { spawnSync } from 'node:child_process';

export type Segment = ['a' | 'b' | 'c' | 'black' | 'frozen', number];

function src(kind: Segment[0], seconds: number, size = '320x240'): string {
  switch (kind) {
    case 'a':
      return `testsrc2=size=${size}:rate=24:duration=${seconds}`;
    case 'b':
      return `mandelbrot=size=${size}:rate=24,trim=duration=${seconds}`;
    case 'c':
      return `life=size=${size}:rate=24:ratio=0.3:mold=10,trim=duration=${seconds}`;
    case 'black':
      return `color=black:size=${size}:rate=24:duration=${seconds}`;
    case 'frozen':
      return `color=0x3355aa:size=${size}:rate=24:duration=${seconds}`;
  }
}

/** Build a synthetic mp4 from lavfi segments with hard cuts (mirrors workers/qc/tests/conftest.py). */
export function makeClip(dest: string, segments: Segment[], audio = false): string {
  const inputs: string[] = [];
  const filt: string[] = [];
  segments.forEach(([kind, sec], i) => {
    inputs.push('-f', 'lavfi', '-i', src(kind, sec));
    filt.push(`[${i}:v]format=yuv420p,setsar=1[v${i}]`);
  });
  const n = segments.length;
  filt.push(segments.map((_, i) => `[v${i}]`).join('') + `concat=n=${n}:v=1:a=0[outv]`);
  const args = ['-hide_banner', '-loglevel', 'error', '-y', ...inputs];
  if (audio) args.push('-f', 'lavfi', '-i', `sine=frequency=440:duration=${segments.reduce((s, [, d]) => s + d, 0)}`);
  args.push('-filter_complex', filt.join(';'), '-map', '[outv]');
  if (audio) args.push('-map', `${n}:a`, '-c:a', 'aac');
  args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', dest);
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr}`);
  return dest;
}
