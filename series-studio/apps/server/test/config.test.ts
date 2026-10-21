import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { engineConfig, loadConfig } from '../src/config.js';
import { makeTempStudio } from './helpers.js';

describe('config', () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => cleanups.splice(0).forEach((c) => c()));

  it('loads studio.json and resolves directories', () => {
    const t = makeTempStudio();
    cleanups.push(t.cleanup);
    const cfg = loadConfig({ root: t.root });
    expect(cfg.projects_dir).toBe(join(t.root, 'projects'));
    expect(cfg.http.host).toBe('127.0.0.1');
    expect(engineConfig(cfg, 'manual').maxClipSec).toBeGreaterThan(0);
    expect(() => engineConfig(cfg, 'nope')).toThrow(/ไม่รู้จัก engine/);
  });

  it('merges config/local.json overrides deeply', () => {
    const t = makeTempStudio();
    cleanups.push(t.cleanup);
    writeFileSync(join(t.root, 'config', 'local.json'), JSON.stringify({ engines: { manual: { maxClipSec: 5 } }, qc: { cer_max: 0.4 } }));
    const cfg = loadConfig({ root: t.root });
    expect(cfg.engines['manual']?.maxClipSec).toBe(5);
    expect(cfg.engines['manual']?.supportsRefImages).toBe(true); // untouched sibling kept
    expect(cfg.qc.cer_max).toBe(0.4);
    expect(cfg.qc.cut_tolerance).toBe(1);
  });

  it('rejects a non-loopback host', () => {
    const t = makeTempStudio();
    cleanups.push(t.cleanup);
    writeFileSync(join(t.root, 'config', 'local.json'), JSON.stringify({ http: { host: '0.0.0.0', port: 8787 } }));
    expect(() => loadConfig({ root: t.root })).toThrow(/config/);
  });
});
