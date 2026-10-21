import { join } from 'node:path';
import { Continuity, deriveContinuity, validateContinuity, type CharacterState, type Continuity as ContinuityT, type ContinuityEntry, type ValidationReport } from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { EpisodeService } from './episode.js';
import { SeriesService } from './series.js';

/** continuity.json: state of every character after each episode (SPEC §6/§7, M8). */
export class ContinuityService {
  private readonly series: SeriesService;
  private readonly episodes: EpisodeService;

  constructor(private readonly ctx: StudioContext) {
    this.series = new SeriesService(ctx);
    this.episodes = new EpisodeService(ctx);
  }

  file(seriesId: string): string {
    return join(this.ctx.store.seriesDir(seriesId), 'continuity.json');
  }

  load(seriesId: string): ContinuityT {
    this.series.load(seriesId);
    return this.ctx.store.readJsonIfExists(this.file(seriesId), Continuity, 'continuity.json') ?? Continuity.parse({});
  }

  entryAfter(seriesId: string, episode: number): ContinuityEntry | undefined {
    return this.load(seriesId).entries.find((e) => e.after_episode === episode);
  }

  /**
   * Record the state after `episode`. With auto=true (default) the wardrobe of each character is
   * derived from their last shot and everything else is carried from the previous entry; `states`
   * overrides fields (empty string clears one, e.g. a healed injury).
   */
  update(seriesId: string, episode: number, opts: { states?: Record<string, CharacterState> | undefined; notes?: string | undefined; auto?: boolean | undefined }): { entry: ContinuityEntry; report: ValidationReport } {
    const series = this.series.load(seriesId);
    this.series.requireEpisode(series, episode);
    const current = this.load(seriesId);
    const previous = current.entries.find((e) => e.after_episode === episode - 1);
    let entry: ContinuityEntry;
    if (opts.auto ?? true) {
      const shotsFile = this.ctx.store.episodePath(seriesId, episode, 'shots.json');
      const shots = this.ctx.store.exists(shotsFile) ? this.episodes.loadShots(seriesId, episode).shots : [];
      entry = deriveContinuity(episode, shots, previous, opts.states ?? {});
    } else {
      entry = { after_episode: episode, states: opts.states ?? {} };
    }
    if (opts.notes) entry.notes = opts.notes;
    const characters = this.series.listEntities(seriesId, 'character');
    const report = validateContinuity(entry, characters);
    if (!report.ok) return { entry, report };
    const entries = [...current.entries.filter((e) => e.after_episode !== episode), entry].sort((a, b) => a.after_episode - b.after_episode);
    this.ctx.store.writeJson(this.file(seriesId), Continuity.parse({ entries }));
    this.ctx.log.info('continuity_updated', { series_id: seriesId, after_episode: episode, characters: Object.keys(entry.states).length });
    this.ctx.emit({ type: 'continuity', series_id: seriesId, episode });
    return { entry, report };
  }
}
