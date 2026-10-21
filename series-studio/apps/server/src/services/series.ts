import { join } from 'node:path';
import {
  Bible,
  Character,
  Continuity,
  Cost,
  EpisodeState,
  Location,
  Outline,
  Prop,
  Series,
  Voices,
  type Bible as BibleT,
  type Character as CharacterT,
  type EntityType,
  type EpisodeState as EpisodeStateT,
  type Location as LocationT,
  type Prop as PropT,
  type Series as SeriesT,
  type SeriesInput,
  episodeDir,
  parseOrThrow,
  slugify,
} from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { requirePreset } from '../context.js';

export type Entity = CharacterT | LocationT | PropT;
export const ENTITY_DIR: Record<EntityType, 'characters' | 'locations' | 'props'> = {
  character: 'characters',
  location: 'locations',
  prop: 'props',
};
const ENTITY_SCHEMA = { character: Character, location: Location, prop: Prop } as const;
export const ENTITY_LABEL: Record<EntityType, string> = { character: 'ตัวละคร', location: 'ฉาก', prop: 'ของ' };

/** Everything about series.json, bible files and episode state on disk. */
export class SeriesService {
  constructor(private readonly ctx: StudioContext) {}

  private get store() {
    return this.ctx.store;
  }

  // ------------------------------------------------------------ series.json
  seriesFile(id: string): string {
    return join(this.store.seriesDir(id), 'series.json');
  }

  exists(id: string): boolean {
    return this.store.seriesExists(id);
  }

  load(id: string): SeriesT {
    if (!this.exists(id)) {
      const known = this.store.listSeriesIds();
      throw new Error(`ไม่พบซีรีส์ "${id}"${known.length ? ` ซีรีส์ที่มี: ${known.join(', ')}` : ' (ยังไม่มีซีรีส์ ใช้ create_series ก่อน)'}`);
    }
    return this.store.readJson(this.seriesFile(id), Series, 'series.json');
  }

  save(series: SeriesT): SeriesT {
    const next = parseOrThrow(Series, { ...series, updated_at: this.ctx.now() }, 'series.json');
    this.store.writeJson(this.seriesFile(next.id), next);
    return next;
  }

  create(input: Omit<SeriesInput, 'created_at' | 'updated_at' | 'status' | 'gates' | 'id'> & { id?: string | undefined }): SeriesT {
    const preset = requirePreset(this.ctx, input.style_id);
    if (!preset.camera.aspect_modes.includes(input.aspect)) {
      throw new Error(`สไตล์ "${preset.id}" รองรับอัตราส่วน ${preset.camera.aspect_modes.join(', ')} เท่านั้น (ขอ ${input.aspect})`);
    }
    const id = input.id ?? (slugify(input.title) || `series-${this.ctx.now().replace(/[-:.TZ]/g, '').slice(0, 14)}`);
    if (this.exists(id)) throw new Error(`มีซีรีส์ "${id}" อยู่แล้ว ใช้ get_series เพื่อดูสถานะ หรือตั้ง id ใหม่`);
    const engine_id = input.engine_id ?? this.ctx.config.default_engine;
    if (!this.ctx.config.engines[engine_id]) throw new Error(`ไม่รู้จัก engine "${engine_id}"`);
    if (input.product) {
      const bad = input.product.bridge_episodes.filter((n) => n > input.episodes);
      if (bad.length) throw new Error(`product.bridge_episodes มีตอนที่เกินจำนวนตอน: ${bad.join(', ')}`);
    }
    const now = this.ctx.now();
    const series = parseOrThrow(Series, { ...input, id, engine_id, created_at: now, updated_at: now }, 'series.json');
    this.store.ensureSeriesSkeleton(id, series.episodes);
    this.store.writeJson(this.seriesFile(id), series);
    this.store.writeJson(join(this.store.seriesDir(id), 'continuity.json'), Continuity.parse({}));
    this.store.writeJson(join(this.store.seriesDir(id), 'cost.json'), Cost.parse({}));
    for (let n = 1; n <= series.episodes; n++) {
      this.saveEpisodeState(id, EpisodeState.parse({ episode: n }));
    }
    this.ctx.log.info('series_created', { series_id: id, style_id: series.style_id, episodes: series.episodes });
    this.ctx.emit({ type: 'series_created', series_id: id });
    return series;
  }

  list(): SeriesT[] {
    return this.store.listSeriesIds().map((id) => this.load(id));
  }

  // ------------------------------------------------------------ bible
  storyFile(id: string): string {
    return this.store.biblePath(id, 'story.md');
  }

  entityFile(id: string, type: EntityType, entityId: string): string {
    return this.store.biblePath(id, ENTITY_DIR[type], `${entityId}.json`);
  }

  loadEntity<T extends EntityType>(id: string, type: T, entityId: string): (typeof ENTITY_SCHEMA)[T]['_output'] {
    const file = this.entityFile(id, type, entityId);
    if (!this.store.exists(file)) throw new Error(`ไม่พบ${ENTITY_LABEL[type]} "${entityId}" ในซีรีส์ "${id}"`);
    return this.store.readJson(file, ENTITY_SCHEMA[type], `${ENTITY_DIR[type]}/${entityId}.json`) as (typeof ENTITY_SCHEMA)[T]['_output'];
  }

  loadEntityIfExists<T extends EntityType>(id: string, type: T, entityId: string): (typeof ENTITY_SCHEMA)[T]['_output'] | undefined {
    return this.store.exists(this.entityFile(id, type, entityId)) ? this.loadEntity(id, type, entityId) : undefined;
  }

  saveEntity(id: string, type: EntityType, entity: Entity): void {
    const parsed = parseOrThrow(ENTITY_SCHEMA[type], entity, `${ENTITY_DIR[type]}/${entity.id}.json`);
    this.store.writeJson(this.entityFile(id, type, entity.id), parsed);
  }

  listEntities<T extends EntityType>(id: string, type: T): Array<(typeof ENTITY_SCHEMA)[T]['_output']> {
    const dir = this.store.biblePath(id, ENTITY_DIR[type]);
    return this.store.listFiles(dir, '.json').map((f) => this.loadEntity(id, type, f.replace(/\.json$/, '')));
  }

  loadVoices(id: string) {
    return this.store.readJsonIfExists(this.store.biblePath(id, 'voices.json'), Voices, 'voices.json') ?? {};
  }

  /** Assemble the whole bible from disk (undefined when story.md does not exist yet). */
  loadBible(id: string): BibleT | undefined {
    if (!this.store.exists(this.storyFile(id))) return undefined;
    return Bible.parse({
      story_md: this.store.readText(this.storyFile(id), 'story.md'),
      characters: this.listEntities(id, 'character'),
      locations: this.listEntities(id, 'location'),
      props: this.listEntities(id, 'prop'),
      voices: this.loadVoices(id),
    });
  }

  // ------------------------------------------------------------ episodes
  outlineFile(id: string, n: number): string {
    return this.store.episodePath(id, n, 'outline.json');
  }

  loadOutline(id: string, n: number) {
    return this.store.readJsonIfExists(this.outlineFile(id, n), Outline, `${episodeDir(n)}/outline.json`);
  }

  episodeStateFile(id: string, n: number): string {
    return this.store.episodePath(id, n, 'state.json');
  }

  loadEpisodeState(id: string, n: number): EpisodeStateT {
    return this.store.readJsonIfExists(this.episodeStateFile(id, n), EpisodeState, `${episodeDir(n)}/state.json`) ?? EpisodeState.parse({ episode: n });
  }

  saveEpisodeState(id: string, state: EpisodeStateT): EpisodeStateT {
    const next = parseOrThrow(EpisodeState, { ...state, updated_at: this.ctx.now() }, 'state.json');
    this.store.writeJson(this.episodeStateFile(id, state.episode), next);
    this.ctx.emit({ type: 'episode_state', series_id: id, episode: state.episode, status: next.status });
    return next;
  }

  requireEpisode(series: SeriesT, n: number): void {
    if (n < 1 || n > series.episodes) throw new Error(`ตอนที่ ${n} ไม่มีในซีรีส์ "${series.id}" (มี ${series.episodes} ตอน)`);
  }
}
