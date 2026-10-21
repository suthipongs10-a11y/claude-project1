import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, type StudioContext } from '../src/context.js';

export const REPO_STUDIO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

/** A throw-away studio root with the real config + presets and an empty projects/ folder. */
export function makeTempStudio(): { root: string; ctx: StudioContext; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'series-studio-test-'));
  cpSync(join(REPO_STUDIO_ROOT, 'config'), join(root, 'config'), { recursive: true });
  cpSync(join(REPO_STUDIO_ROOT, 'presets'), join(root, 'presets'), { recursive: true });
  mkdirSync(join(root, 'projects'));
  const ctx = createContext({ root, logger: 'silent', now: () => '2026-10-21T00:00:00.000Z' });
  return { root, ctx, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
