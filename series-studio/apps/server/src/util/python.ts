import { spawnSync } from 'node:child_process';
import { isAbsolute, resolve } from 'node:path';

const cache = new Map<string, string>();

/**
 * Find a working Python 3 for the QC worker. `configured` comes from config tools.python:
 * an explicit path (absolute, or relative to `root`, e.g. ".venv/bin/python" or
 * ".venv\\Scripts\\python.exe") is used as is; the generic default "python3" is resolved per
 * platform because Windows ships `py`/`python` and only a Store alias named python3.
 */
export function resolvePython(configured: string, root: string): string {
  const key = `${root}|${configured}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const candidates: string[] = [];
  if (configured.includes('/') || configured.includes('\\')) {
    candidates.push(isAbsolute(configured) ? configured : resolve(root, configured));
  } else if (configured === 'python3' || configured === 'python') {
    candidates.push(...(process.platform === 'win32' ? ['py', 'python', 'python3'] : ['python3', 'python']));
  } else {
    candidates.push(configured);
  }
  for (const cmd of candidates) {
    const r = spawnSync(cmd, ['-c', 'import sys; print(sys.version_info[0])'], { encoding: 'utf8', timeout: 15000, windowsHide: true });
    if (r.status === 0 && r.stdout.trim() === '3') {
      cache.set(key, cmd);
      return cmd;
    }
  }
  throw new Error(
    `ไม่พบ Python 3 (ลองแล้ว: ${candidates.join(', ')}) — ติดตั้ง Python 3.11+ หรือตั้ง tools.python ใน config/local.json ให้ชี้ไปที่ python ของ venv เช่น ".venv/bin/python" หรือ ".venv\\\\Scripts\\\\python.exe"`,
  );
}
