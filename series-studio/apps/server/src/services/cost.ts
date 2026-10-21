import { join } from 'node:path';
import { Cost, type Cost as CostT } from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { engineConfig } from '../config.js';
import { EpisodeService } from './episode.js';
import { SeriesService } from './series.js';

export interface EpisodeCostRow {
  episode: number;
  credits: number;
  jobs: number;
  clip_jobs: { draft: number; final: number; regen: number; failed: number };
  batches: number;
  /** What generating every batch once at final quality would cost (the "no QC, no drafts" baseline). */
  baseline_all_final: number;
}

export interface CostReport {
  series_id: string;
  engine_id: string;
  credits_per_clip: { draft: number; final: number };
  episodes: EpisodeCostRow[];
  total_credits: number;
  total_baseline: number;
  savings_pct: number | null;
  ref_jobs: number;
}

/** SPEC §9 cost_report / §15 target: credits per episode vs the all-final baseline. */
export class CostService {
  private readonly series: SeriesService;
  private readonly episodes: EpisodeService;

  constructor(private readonly ctx: StudioContext) {
    this.series = new SeriesService(ctx);
    this.episodes = new EpisodeService(ctx);
  }

  report(seriesId: string): CostReport {
    const series = this.series.load(seriesId);
    const cfg = engineConfig(this.ctx.config, series.engine_id);
    const cost: CostT = this.ctx.store.readJsonIfExists(join(this.ctx.store.seriesDir(seriesId), 'cost.json'), Cost, 'cost.json') ?? Cost.parse({});
    const rows: EpisodeCostRow[] = [];
    let totalBaseline = 0;
    for (let n = 1; n <= series.episodes; n++) {
      const c = cost.episodes[String(n)] ?? { credits: 0, jobs: 0 };
      const jobs = this.ctx.jobs.list({ series_id: seriesId, episode: n, kind: 'clip' });
      const batches = this.episodes.loadBatches(seriesId, n).length;
      const baseline = batches * cfg.creditsPerClip.final;
      totalBaseline += baseline;
      rows.push({
        episode: n,
        credits: c.credits,
        jobs: c.jobs,
        clip_jobs: {
          draft: jobs.filter((j) => j.quality === 'draft').length,
          final: jobs.filter((j) => j.quality === 'final').length,
          regen: jobs.filter((j) => j.attempt > 1).length,
          failed: jobs.filter((j) => j.status === 'failed' || j.status === 'blocked').length,
        },
        batches,
        baseline_all_final: baseline,
      });
    }
    const refJobs = this.ctx.jobs.list({ series_id: seriesId, kind: 'ref' }).length;
    return {
      series_id: seriesId,
      engine_id: series.engine_id,
      credits_per_clip: cfg.creditsPerClip,
      episodes: rows,
      total_credits: cost.total_credits,
      total_baseline: totalBaseline,
      savings_pct: totalBaseline > 0 ? Math.round(((totalBaseline - cost.total_credits) / totalBaseline) * 1000) / 10 : null,
      ref_jobs: refJobs,
    };
  }
}
