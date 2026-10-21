import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

export interface LoggerOptions {
  dir: string;
  file?: string;
  /** Also echo to stderr (never stdout: stdout is the MCP channel). */
  stderr?: boolean;
  level?: LogLevel;
}

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Minimal JSON-lines logger writing to logs/<file>.jsonl (CLAUDE.md: logs are JSON lines). */
export function createLogger(opts: LoggerOptions, base: Record<string, unknown> = {}): Logger {
  const file = join(opts.dir, opts.file ?? 'server.jsonl');
  const min = ORDER[opts.level ?? 'info'];
  let dirReady = false;
  const write = (level: LogLevel, msg: string, fields?: Record<string, unknown>) => {
    if (ORDER[level] < min) return;
    const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...base, ...fields });
    try {
      if (!dirReady) {
        mkdirSync(opts.dir, { recursive: true });
        dirReady = true;
      }
      appendFileSync(file, line + '\n');
    } catch {
      // logging must never crash the server
    }
    if (opts.stderr) process.stderr.write(line + '\n');
  };
  return {
    debug: (m, f) => write('debug', m, f),
    info: (m, f) => write('info', m, f),
    warn: (m, f) => write('warn', m, f),
    error: (m, f) => write('error', m, f),
    child: (fields) => createLogger(opts, { ...base, ...fields }),
  };
}

export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLogger,
};
