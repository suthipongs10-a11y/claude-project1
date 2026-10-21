import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Spawn a process and collect output (no shell). */
export function run(cmd: string, args: string[], opts: { cwd?: string | undefined; timeoutMs?: number | undefined; env?: NodeJS.ProcessEnv | undefined } = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env ?? process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = opts.timeoutMs ? setTimeout(() => child.kill('SIGKILL'), opts.timeoutMs) : undefined;
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (e: NodeJS.ErrnoException) => {
      if (timer) clearTimeout(timer);
      reject(e.code === 'ENOENT' ? new Error(`ไม่พบโปรแกรม "${cmd}" (ตั้งค่าใน config/studio.json → tools)`) : e);
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

export async function probeDuration(ffprobe: string, file: string): Promise<number> {
  const r = await run(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', file]);
  if (r.code !== 0) throw new Error(`ffprobe อ่าน ${file} ไม่ได้: ${r.stderr.trim()}`);
  const d = Number((JSON.parse(r.stdout || '{}') as { format?: { duration?: string } }).format?.duration);
  if (!Number.isFinite(d)) throw new Error(`อ่านความยาวของ ${file} ไม่ได้`);
  return d;
}

/** Extract one JPEG frame at `t` seconds (scaled to `width`). */
export async function extractFrame(ffmpeg: string, file: string, t: number, dest: string, width = 640): Promise<string> {
  mkdirSync(dirname(dest), { recursive: true });
  const r = await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', Math.max(0, t).toFixed(3), '-i', file, '-frames:v', '1', '-vf', `scale=${width}:-2`, dest]);
  if (r.code !== 0) throw new Error(`ดึงเฟรมที่ ${t.toFixed(1)}s จาก ${file} ไม่ได้: ${r.stderr.trim()}`);
  return dest;
}

/** n frames spread inside [start, start+duration): 10%, 50%, 90% for n = 3. */
export async function extractKeyframes(ffmpeg: string, file: string, start: number, duration: number, n: number, destDir: string, stem: string): Promise<string[]> {
  const fracs = n <= 1 ? [0.5] : Array.from({ length: n }, (_, i) => 0.1 + (0.8 * i) / (n - 1));
  const out: string[] = [];
  for (const [i, f] of fracs.entries()) out.push(await extractFrame(ffmpeg, file, start + duration * f, `${destDir}/${stem}_${i + 1}.jpg`));
  return out;
}

export async function hasAudio(ffprobe: string, file: string): Promise<boolean> {
  const r = await run(ffprobe, ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'json', file]);
  if (r.code !== 0) return false;
  return ((JSON.parse(r.stdout || '{}') as { streams?: unknown[] }).streams?.length ?? 0) > 0;
}

export interface LoudnessStats {
  input_i: number;
  input_tp: number;
  input_lra: number;
  input_thresh: number;
  target_offset: number;
}

/** First pass of two-pass loudnorm: measure integrated loudness etc. */
export async function measureLoudness(ffmpeg: string, file: string, targetI: number, tp = -1.5, lra = 11): Promise<LoudnessStats> {
  const r = await run(ffmpeg, ['-hide_banner', '-nostats', '-i', file, '-af', `loudnorm=I=${targetI}:TP=${tp}:LRA=${lra}:print_format=json`, '-vn', '-f', 'null', '-']);
  const m = /\{[\s\S]*\}\s*$/.exec(r.stderr);
  if (!m) throw new Error(`วัดความดังไม่ได้: ${r.stderr.slice(-400)}`);
  const j = JSON.parse(m[0]) as Record<string, string>;
  const num = (k: string) => {
    const v = Number(j[k]);
    return Number.isFinite(v) ? v : -70;
  };
  return { input_i: num('input_i'), input_tp: num('input_tp'), input_lra: num('input_lra'), input_thresh: num('input_thresh'), target_offset: num('target_offset') };
}

/** Integrated loudness (LUFS) of a finished file, via ebur128. */
export async function integratedLoudness(ffmpeg: string, file: string): Promise<number> {
  const r = await run(ffmpeg, ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=framelog=quiet', '-vn', '-f', 'null', '-']);
  const m = /I:\s*(-?[0-9.]+)\s*LUFS/g;
  let last: number | undefined;
  for (const hit of r.stderr.matchAll(m)) last = Number(hit[1]);
  if (last === undefined) throw new Error(`อ่านค่า LUFS ไม่ได้: ${r.stderr.slice(-300)}`);
  return last;
}
