import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { dirname, join } from 'node:path';

/** Pairing token for the dashboard and the Chrome extension (CLAUDE.md rule 7). Stored in data/token.txt. */
export function loadOrCreateToken(dataDir: string): string {
  const file = join(dataDir, 'token.txt');
  if (existsSync(file)) {
    const t = readFileSync(file, 'utf8').trim();
    if (t.length >= 16) return t;
  }
  mkdirSync(dirname(file), { recursive: true });
  const t = randomBytes(24).toString('hex');
  writeFileSync(file, t + '\n', { mode: 0o600 });
  return t;
}

export function tokenMatches(expected: string, given: string | undefined): boolean {
  if (!given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
