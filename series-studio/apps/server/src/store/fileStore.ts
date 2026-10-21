import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync, statSync, copyFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep, basename, extname } from 'node:path';
import { z } from 'zod';
import { episodeDir, parseOrThrow, Slug } from '@series-studio/core';

/**
 * File store for projects/<series-slug>/ (SPEC §6).
 * Rules (CLAUDE.md): never delete inside projects/ -> move to _trash/; locked refs are never
 * overwritten -> new version. All writes are atomic (tmp + rename).
 */
export class FileStore {
  constructor(readonly projectsDir: string) {}

  // ------------------------------------------------------------ paths
  seriesDir(seriesId: string): string {
    Slug.parse(seriesId);
    return join(this.projectsDir, seriesId);
  }

  episodePath(seriesId: string, episode: number, ...rest: string[]): string {
    return join(this.seriesDir(seriesId), 'episodes', episodeDir(episode), ...rest);
  }

  biblePath(seriesId: string, ...rest: string[]): string {
    return join(this.seriesDir(seriesId), 'bible', ...rest);
  }

  /** Path relative to the series folder, always with forward slashes. */
  rel(seriesId: string, absPath: string): string {
    return relative(this.seriesDir(seriesId), absPath).split(sep).join('/');
  }

  abs(seriesId: string, relPath: string): string {
    const base = this.seriesDir(seriesId);
    const out = resolve(base, relPath);
    if (out !== base && !out.startsWith(base + sep)) {
      throw new Error(`path อยู่นอกโฟลเดอร์ซีรีส์: ${relPath}`);
    }
    return out;
  }

  // ------------------------------------------------------------ series listing
  seriesExists(seriesId: string): boolean {
    return existsSync(join(this.seriesDir(seriesId), 'series.json'));
  }

  listSeriesIds(): string[] {
    if (!existsSync(this.projectsDir)) return [];
    return readdirSync(this.projectsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
      .filter((d) => existsSync(join(this.projectsDir, d.name, 'series.json')))
      .map((d) => d.name)
      .sort();
  }

  /** Create the canonical folder skeleton for a series. Idempotent. */
  ensureSeriesSkeleton(seriesId: string, episodes: number): void {
    const dirs = [
      this.biblePath(seriesId, 'characters'),
      this.biblePath(seriesId, 'locations'),
      this.biblePath(seriesId, 'props'),
    ];
    for (let n = 1; n <= episodes; n++) {
      dirs.push(this.episodePath(seriesId, n, 'batches'));
      dirs.push(this.episodePath(seriesId, n, 'gen'));
      dirs.push(this.episodePath(seriesId, n, 'qc'));
      dirs.push(this.episodePath(seriesId, n, 'edit'));
      dirs.push(this.episodePath(seriesId, n, 'final'));
    }
    for (const d of dirs) mkdirSync(d, { recursive: true });
  }

  // ------------------------------------------------------------ json / text io
  readJson<T extends z.ZodType>(absPath: string, schema: T, what: string): z.output<T> {
    if (!existsSync(absPath)) throw new Error(`ไม่พบไฟล์ ${what}: ${absPath}`);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(absPath, 'utf8'));
    } catch (e) {
      throw new Error(`ไฟล์ ${what} ไม่ใช่ JSON ที่ถูกต้อง: ${absPath} (${(e as Error).message})`);
    }
    return parseOrThrow(schema, raw, what);
  }

  readJsonIfExists<T extends z.ZodType>(absPath: string, schema: T, what: string): z.output<T> | undefined {
    return existsSync(absPath) ? this.readJson(absPath, schema, what) : undefined;
  }

  writeJson(absPath: string, data: unknown): void {
    this.writeText(absPath, JSON.stringify(data, null, 2) + '\n');
  }

  writeText(absPath: string, text: string): void {
    mkdirSync(dirname(absPath), { recursive: true });
    const tmp = `${absPath}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tmp, text, 'utf8');
    renameSync(tmp, absPath);
  }

  readText(absPath: string, what: string): string {
    if (!existsSync(absPath)) throw new Error(`ไม่พบไฟล์ ${what}: ${absPath}`);
    return readFileSync(absPath, 'utf8');
  }

  exists(absPath: string): boolean {
    return existsSync(absPath);
  }

  listFiles(absDir: string, ext?: string): string[] {
    if (!existsSync(absDir)) return [];
    return readdirSync(absDir, { withFileTypes: true })
      .filter((d) => d.isFile() && !d.name.endsWith('.tmp') && (ext === undefined || extname(d.name) === ext))
      .map((d) => d.name)
      .sort();
  }

  // ------------------------------------------------------------ trash instead of delete
  /**
   * Move a file or folder into projects/<series>/_trash/<timestamp>/<original relative path>.
   * Returns the new absolute path. (CLAUDE.md rule 6: never delete inside projects/.)
   */
  moveToTrash(seriesId: string, absPath: string): string {
    if (!existsSync(absPath)) throw new Error(`ไม่พบไฟล์ที่จะย้ายไป _trash: ${absPath}`);
    const rel = this.rel(seriesId, absPath);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = join(this.seriesDir(seriesId), '_trash', stamp, rel);
    mkdirSync(dirname(dest), { recursive: true });
    renameSync(absPath, dest);
    return dest;
  }

  /**
   * Copy a reference image into an entity's refs folder. If the entity is locked the call
   * is refused (CLAUDE.md rule 5). Returns the stored relative path.
   */
  storeRef(
    seriesId: string,
    entityKind: 'characters' | 'locations' | 'props',
    entityId: string,
    sourceAbsPath: string,
    opts: { locked: boolean; version: number; name?: string },
  ): string {
    if (opts.locked) {
      throw new Error(`asset ${entityId} ถูก lock อยู่ ห้ามเขียนทับ ref ต้อง unlock ก่อนแล้วระบบจะเพิ่มเวอร์ชันใหม่`);
    }
    if (!existsSync(sourceAbsPath) || !statSync(sourceAbsPath).isFile()) {
      throw new Error(`ไม่พบไฟล์ภาพอ้างอิง: ${sourceAbsPath}`);
    }
    const name = opts.name ?? basename(sourceAbsPath);
    const dir = this.biblePath(seriesId, entityKind, entityId, 'refs', `v${opts.version}`);
    mkdirSync(dir, { recursive: true });
    const dest = join(dir, name);
    copyFileSync(sourceAbsPath, dest);
    return this.rel(seriesId, dest);
  }
}
