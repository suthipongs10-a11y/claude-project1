import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { parsePreset, type StylePreset } from '@series-studio/core';
import { loadConfig, type LoadConfigOptions, type ResolvedConfig } from './config.js';
import { FileStore } from './store/fileStore.js';
import { createLogger, silentLogger, type Logger } from './util/log.js';
import { JobStore } from './store/db.js';
import type { ExtensionBridge } from './ext/bridge.js';
import { TaskService } from './services/tasks.js';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';

/** Everything a tool needs. Built once per server process (or per test). */
export interface StudioContext {
  config: ResolvedConfig;
  store: FileStore;
  jobs: JobStore;
  log: Logger;
  /** In-process change feed: services emit { type, series_id, episode?, ... }; HTTP/WS fan out to clients. */
  events: EventEmitter;
  emit(event: StudioEvent): void;
  /** Set when the HTTP server is running: bridge to the Chrome extension (flow_ext). */
  ext?: ExtensionBridge;
  /** Background tasks for long operations (assemble, run_qc, dub_episode). */
  tasks: TaskService;
  /** Loaded presets by id. Reloaded with reloadPresets(). */
  presets: Map<string, StylePreset>;
  /** Presets that failed to load (file -> Thai error message). */
  presetErrors: Map<string, string>;
  reloadPresets(): void;
  now(): string;
}

export interface StudioEvent {
  type: string;
  series_id?: string;
  episode?: number;
  [k: string]: unknown;
}

export interface ContextOptions extends LoadConfigOptions {
  logger?: Logger | 'file' | 'silent';
  now?: () => string;
  /** SQLite file for the job queue; defaults to <data_dir>/studio.sqlite. Use ':memory:' in tests. */
  jobsDb?: string;
}

export function loadPresetsFrom(dir: string): { presets: Map<string, StylePreset>; errors: Map<string, string> } {
  const presets = new Map<string, StylePreset>();
  const errors = new Map<string, string>();
  if (!existsSync(dir)) return { presets, errors };
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const file = join(dir, name);
    try {
      const p = parsePreset(JSON.parse(readFileSync(file, 'utf8')), name);
      if (p.id !== name.replace(/\.json$/, '')) {
        errors.set(name, `preset id "${p.id}" ไม่ตรงกับชื่อไฟล์ ${name}`);
        continue;
      }
      presets.set(p.id, p);
    } catch (e) {
      errors.set(name, (e as Error).message);
    }
  }
  return { presets, errors };
}

export function createContext(opts: ContextOptions = {}): StudioContext {
  const config = loadConfig(opts);
  const log =
    opts.logger === undefined || opts.logger === 'file'
      ? createLogger({ dir: config.logs_dir, stderr: process.env['SERIES_STUDIO_LOG_STDERR'] === '1' })
      : opts.logger === 'silent'
        ? silentLogger
        : opts.logger;
  const store = new FileStore(config.projects_dir);
  const jobs = new JobStore(opts.jobsDb ?? join(config.data_dir, 'studio.sqlite'));
  const events = new EventEmitter();
  events.setMaxListeners(100);
  const ctx: StudioContext = {
    config,
    store,
    jobs,
    log,
    events,
    emit(event) {
      events.emit('change', { ...event, at: ctx.now() });
    },
    presets: new Map(),
    presetErrors: new Map(),
    reloadPresets() {
      const { presets, errors } = loadPresetsFrom(config.presets_dir);
      ctx.presets = presets;
      ctx.presetErrors = errors;
      for (const [file, msg] of errors) log.warn('preset_load_failed', { file, error: msg });
      log.info('presets_loaded', { count: presets.size, dir: config.presets_dir });
    },
    now: opts.now ?? (() => new Date().toISOString()),
    tasks: undefined as unknown as TaskService,
  };
  (ctx as { tasks: TaskService }).tasks = new TaskService(ctx);
  ctx.reloadPresets();
  return ctx;
}

export function requirePreset(ctx: StudioContext, styleId: string): StylePreset {
  const p = ctx.presets.get(styleId);
  if (!p) {
    const known = [...ctx.presets.keys()].join(', ') || '(ไม่มี)';
    throw new Error(`ไม่พบสไตล์ "${styleId}" สไตล์ที่มี: ${known}`);
  }
  return p;
}
