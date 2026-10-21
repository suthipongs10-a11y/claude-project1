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
