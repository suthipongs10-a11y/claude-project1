import { existsSync, statSync } from 'node:fs';
import { extname, isAbsolute, resolve } from 'node:path';
import {
  Bible,
  Character,
  Location,
  Prop,
  characterRefPrompt,
  defaultViews,
  locationRefPrompt,
  propRefPrompt,
  validateBible,
  type Bible as BibleT,
  type Character as CharacterT,
  type EntityType,
  type GenJob,
  type Location as LocationT,
  type Prop as PropT,
  type Series as SeriesT,
  type ValidationReport,
  type Voices as VoicesT,
} from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { requirePreset } from '../context.js';
import type { JobStore } from '../store/db.js';
import { ENTITY_DIR, ENTITY_LABEL, SeriesService, type Entity } from './series.js';

/** Fields managed by the asset tools, never by write_bible. */
const MANAGED = ['refs', 'ref_version', 'locked', 'flow_character_id'] as const;

export interface WriteBibleInput {
  story_md: string;
  characters: Array<Omit<CharacterT, (typeof MANAGED)[number]>>;
  locations: Array<Omit<LocationT, (typeof MANAGED)[number]>>;
  props: Array<Omit<PropT, (typeof MANAGED)[number]>>;
  voices?: VoicesT | undefined;
  extra_forbidden?: string[] | undefined;
}

export interface WriteBibleResult {
  report: ValidationReport;
  written: string[];
  kept: string[];
}

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);

export class BibleService {
  private readonly series: SeriesService;

  constructor(
    private readonly ctx: StudioContext,
    private readonly jobs: JobStore,
  ) {
    this.series = new SeriesService(ctx);
  }

  /**
   * Merge incoming bible with what is on disk, validate everything, then write atomically
   * (nothing is written when validation has errors). Locked assets keep their appearance.
   */
  write(seriesId: string, input: WriteBibleInput): WriteBibleResult {
    const series = this.series.load(seriesId);
    const merged = {
      characters: this.mergeList(seriesId, 'character', input.characters),
      locations: this.mergeList(seriesId, 'location', input.locations),
      props: this.mergeList(seriesId, 'prop', input.props),
    };
    const productId = series.product?.prop_id;
    const bible: BibleT = Bible.parse({
      story_md: input.story_md,
      characters: merged.characters.entities,
      locations: merged.locations.entities,
      props: merged.props.entities.map((p) => (productId && p.id === productId ? { ...p, is_product: true } : p)),
      voices: input.voices ?? this.series.loadVoices(seriesId),
    });
    const extra = input.extra_forbidden ?? [];
    const report = validateBible(bible, series, { extraForbidden: extra });
    const lockErrors = [...merged.characters.lockErrors, ...merged.locations.lockErrors, ...merged.props.lockErrors];
    for (const e of lockErrors) report.errors.push({ level: 'error', code: 'bible.locked', message: e });
    report.ok = report.errors.length === 0;
    if (!report.ok) return { report, written: [], kept: [] };

    const written: string[] = [];
    this.ctx.store.writeText(this.series.storyFile(seriesId), input.story_md.endsWith('\n') ? input.story_md : input.story_md + '\n');
    written.push('bible/story.md');
    for (const c of bible.characters) {
      this.series.saveEntity(seriesId, 'character', c);
      written.push(`bible/characters/${c.id}.json`);
    }
    for (const l of bible.locations) {
      this.series.saveEntity(seriesId, 'location', l);
      written.push(`bible/locations/${l.id}.json`);
    }
    for (const p of bible.props) {
      this.series.saveEntity(seriesId, 'prop', p);
      written.push(`bible/props/${p.id}.json`);
    }
    this.ctx.store.writeJson(this.ctx.store.biblePath(seriesId, 'voices.json'), bible.voices);
    written.push('bible/voices.json');
    if (extra.length) this.ctx.store.writeJson(this.ctx.store.biblePath(seriesId, 'forbidden.json'), extra);

    const kept = [...merged.characters.kept, ...merged.locations.kept, ...merged.props.kept];
    if (kept.length) report.warnings.push({ level: 'warning', code: 'bible.kept_entities', message: `ไม่ได้ส่งมาแต่ยังเก็บไว้ (ย้ายไป _trash เองถ้าไม่ใช้แล้ว): ${kept.join(', ')}` });
    this.ctx.log.info('bible_written', { series_id: seriesId, files: written.length, kept: kept.length });
    this.ctx.emit({ type: 'bible', series_id: seriesId });
    return { report, written, kept };
  }

  private mergeList<T extends EntityType>(
    seriesId: string,
    type: T,
    incoming: Array<Record<string, unknown> & { id: string }>,
  ): { entities: Entity[]; kept: string[]; lockErrors: string[] } {
    const existing = new Map<string, Entity>(this.series.listEntities(seriesId, type).map((e) => [e.id, e as Entity]));
    const entities: Entity[] = [];
    const lockErrors: string[] = [];
    const schema = type === 'character' ? Character : type === 'location' ? Location : Prop;
    for (const raw of incoming) {
      const prev = existing.get(raw.id);
      const managed = prev
        ? { refs: prev.refs, ref_version: prev.ref_version, locked: prev.locked, ...('flow_character_id' in prev ? { flow_character_id: prev.flow_character_id } : {}) }
        : {};
      const next = schema.parse({ ...raw, ...managed }) as Entity;
      if (prev?.locked) {
        const changed = appearanceFields(type).filter((f) => JSON.stringify((prev as Record<string, unknown>)[f]) !== JSON.stringify((next as Record<string, unknown>)[f]));
        if (changed.length) lockErrors.push(`${ENTITY_LABEL[type]} "${raw.id}" ถูก lock อยู่ แก้ ${changed.join(', ')} ไม่ได้ (ต้อง unlock_asset ก่อน)`);
      }
      entities.push(next);
      existing.delete(raw.id);
    }
    const kept: string[] = [];
    for (const [id, e] of existing) {
      entities.push(e);
      kept.push(`${ENTITY_DIR[type]}/${id}`);
    }
    return { entities, kept, lockErrors };
  }

  // ------------------------------------------------------------ references
  /** Deterministic reference prompts for an asset; creates `ref` jobs (manual engine: awaiting_import). */
  genReference(seriesId: string, type: EntityType, entityId: string, views?: string[]): { jobs: GenJob[]; sheet: string } {
    const series = this.series.load(seriesId);
    const preset = requirePreset(this.ctx, series.style_id);
    const entity = this.series.loadEntity(seriesId, type, entityId);
    if (entity.locked) throw new Error(`${ENTITY_LABEL[type]} "${entityId}" ถูก lock อยู่ ต้อง unlock_asset ก่อนจึงเจน ref ใหม่ได้`);
    const list = views && views.length ? views : defaultViews(preset, type, type === 'location' ? (entity as LocationT).time_variants : []);
    const aspect = type === 'location' ? series.aspect : '1:1';
    const prompts = list.map((view) => ({
      view,
      prompt:
        type === 'character'
          ? characterRefPrompt(preset, entity as CharacterT, view, aspect)
          : type === 'location'
            ? locationRefPrompt(preset, entity as LocationT, view, aspect)
            : propRefPrompt(preset, entity as PropT, view, aspect),
    }));
    const now = this.ctx.now();
    const jobs = prompts.map(({ view, prompt }) =>
      this.jobs.create({
        kind: 'ref',
        series_id: seriesId,
        entity_type: type,
        entity_id: entityId,
        view,
        quality: 'final',
        engine_id: series.engine_id,
        status: series.engine_id === 'manual' ? 'awaiting_import' : 'queued',
        attempt: 1,
        prompt,
        shot_ids: [],
        ref_images: [],
        cost_credits: 0,
        created_at: now,
        updated_at: now,
      }),
    );
    const sheet = [
      `# Reference prompts — ${ENTITY_LABEL[type]} ${entityId} (${series.id}, style ${preset.id}, v${entity.ref_version})`,
      '',
      ...prompts.flatMap(({ view, prompt }, i) => [`## ${i + 1}. ${view}`, `job: ${jobs[i]?.id}`, '', '```', prompt, '```', '']),
      'นำภาพที่ได้มาใส่ด้วย import_refs (ระบุ job_id ถ้ารู้ว่าภาพไหนเป็นของ view ไหน)',
    ].join('\n');
    this.ctx.store.writeText(this.ctx.store.biblePath(seriesId, ENTITY_DIR[type], entityId, `ref_prompts_v${entity.ref_version}.md`), sheet + '\n');
    this.ctx.log.info('gen_reference', { series_id: seriesId, type, entity_id: entityId, jobs: jobs.length, engine: series.engine_id });
    return { jobs, sheet };
  }

  /** Copy image files into refs/v<version>/ and attach them to the entity. */
  importRefs(
    seriesId: string,
    type: EntityType,
    entityId: string,
    files: string[],
    opts: { job_id?: string | undefined; replace?: boolean | undefined } = {},
  ): { entity: Entity; added: string[]; warnings: string[] } {
    this.series.load(seriesId);
    const entity = this.series.loadEntity(seriesId, type, entityId) as Entity;
    if (entity.locked) throw new Error(`${ENTITY_LABEL[type]} "${entityId}" ถูก lock อยู่ ต้อง unlock_asset ก่อน (ระบบจะเพิ่มเวอร์ชันใหม่ให้)`);
    if (files.length === 0) throw new Error('ต้องระบุไฟล์ภาพอย่างน้อย 1 ไฟล์');
    const added: string[] = [];
    const warnings: string[] = [];
    for (const f of files) {
      const abs = isAbsolute(f) ? f : resolve(process.cwd(), f);
      if (!existsSync(abs) || !statSync(abs).isFile()) throw new Error(`ไม่พบไฟล์ภาพ: ${f}`);
      if (!IMAGE_EXT.has(extname(abs).toLowerCase())) throw new Error(`รองรับเฉพาะ png/jpg/jpeg/webp: ${f}`);
      added.push(this.ctx.store.storeRef(seriesId, ENTITY_DIR[type], entityId, abs, { locked: false, version: entity.ref_version }));
    }
    const refs = opts.replace ? added : [...entity.refs, ...added.filter((a) => !entity.refs.includes(a))];
    const next = { ...entity, refs } as Entity;
    this.series.saveEntity(seriesId, type, next);
    if (type === 'location') warnings.push('ยังไม่ได้ตรวจว่าภาพฉากมีคนหรือไม่ (ตัวตรวจอัตโนมัติมาใน M3) โปรดดูด้วยตาก่อน lock');
    const now = this.ctx.now();
    if (opts.job_id) {
      const job = this.jobs.get(opts.job_id);
      if (!job || job.entity_id !== entityId) throw new Error(`job ${opts.job_id} ไม่ใช่งาน ref ของ ${entityId}`);
      this.jobs.update(job.id, { status: 'done', output: added[0], updated_at: now });
    } else {
      // without a job id, mark awaiting ref jobs for this asset as done (one per file, in order)
      const pending = this.jobs.list({ series_id: seriesId, kind: 'ref', entity_id: entityId, status: 'awaiting_import' });
      pending.slice(0, added.length).forEach((j, i) => this.jobs.update(j.id, { status: 'done', output: added[i], updated_at: now }));
    }
    this.ctx.log.info('import_refs', { series_id: seriesId, type, entity_id: entityId, added: added.length });
    this.ctx.emit({ type: 'bible', series_id: seriesId, entity_id: entityId });
    return { entity: next, added, warnings };
  }

  lock(seriesId: string, type: EntityType, entityId: string): Entity {
    const series = this.series.load(seriesId);
    const entity = this.series.loadEntity(seriesId, type, entityId) as Entity;
    if (entity.refs.length === 0) throw new Error(`${ENTITY_LABEL[type]} "${entityId}" ยังไม่มีภาพอ้างอิง lock ไม่ได้ (ใช้ gen_reference แล้ว import_refs ก่อน)`);
    const missing = entity.refs.filter((r) => !this.ctx.store.exists(this.ctx.store.abs(seriesId, r)));
    if (missing.length) throw new Error(`ไฟล์ ref หาย: ${missing.join(', ')}`);
    const bible = this.series.loadBible(seriesId);
    if (bible) {
      const report = validateBible(bible, series);
      const mine = report.errors.filter((e) => e.at?.endsWith(`/${entityId}`));
      if (mine.length) throw new Error(`lock ไม่ได้ เพราะ: ${mine.map((m) => m.message).join('; ')}`);
    }
    const next = { ...entity, locked: true } as Entity;
    this.series.saveEntity(seriesId, type, next);
    this.ctx.log.info('asset_locked', { series_id: seriesId, type, entity_id: entityId, version: next.ref_version });
    this.ctx.emit({ type: 'bible', series_id: seriesId, entity_id: entityId });
    return next;
  }

  /** Unlock and open a new reference version; previous refs stay on disk untouched. */
  unlock(seriesId: string, type: EntityType, entityId: string): Entity {
    this.series.load(seriesId);
    const entity = this.series.loadEntity(seriesId, type, entityId) as Entity;
    if (!entity.locked) return entity;
    const next = { ...entity, locked: false, ref_version: entity.ref_version + 1 } as Entity;
    this.series.saveEntity(seriesId, type, next);
    this.ctx.log.info('asset_unlocked', { series_id: seriesId, type, entity_id: entityId, new_version: next.ref_version });
    this.ctx.emit({ type: 'bible', series_id: seriesId, entity_id: entityId });
    return next;
  }
}

function appearanceFields(type: EntityType): string[] {
  return type === 'character' ? ['look', 'wardrobe_default', 'wardrobe_variants', 'name'] : ['look', 'name'];
}

export type { SeriesT };
