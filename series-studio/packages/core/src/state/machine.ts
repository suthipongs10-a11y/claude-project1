import type { EpisodeStatus, SeriesStatus } from '../schemas/index.js';

/** Allowed episode status transitions (forward only, plus regen loops back into generating). */
export const EPISODE_TRANSITIONS: Readonly<Record<EpisodeStatus, readonly EpisodeStatus[]>> = {
  planned: ['scripted'],
  scripted: ['shots_ready', 'scripted'],
  shots_ready: ['prompts_ready', 'scripted', 'shots_ready'],
  prompts_ready: ['generating', 'shots_ready', 'prompts_ready'],
  generating: ['qc', 'generating', 'prompts_ready'],
  qc: ['generating', 'draft_approved', 'qc'],
  draft_approved: ['assembling', 'qc'],
  assembling: ['final_ready', 'assembling', 'draft_approved'],
  final_ready: ['exported', 'assembling'],
  exported: ['exported', 'assembling'],
};

export const SERIES_TRANSITIONS: Readonly<Record<SeriesStatus, readonly SeriesStatus[]>> = {
  planning: ['bible_approved', 'planning'],
  bible_approved: ['assets_locked', 'planning'],
  assets_locked: ['production', 'bible_approved'],
  production: ['complete', 'assets_locked'],
  complete: ['production'],
};

export class TransitionError extends Error {
  constructor(kind: 'episode' | 'series', from: string, to: string) {
    super(
      kind === 'episode'
        ? `เปลี่ยนสถานะตอนจาก "${from}" ไป "${to}" ไม่ได้`
        : `เปลี่ยนสถานะซีรีส์จาก "${from}" ไป "${to}" ไม่ได้`,
    );
    this.name = 'TransitionError';
  }
}

export function canTransitionEpisode(from: EpisodeStatus, to: EpisodeStatus): boolean {
  return EPISODE_TRANSITIONS[from].includes(to);
}

export function transitionEpisode(from: EpisodeStatus, to: EpisodeStatus): EpisodeStatus {
  if (!canTransitionEpisode(from, to)) throw new TransitionError('episode', from, to);
  return to;
}

export function canTransitionSeries(from: SeriesStatus, to: SeriesStatus): boolean {
  return SERIES_TRANSITIONS[from].includes(to);
}

export function transitionSeries(from: SeriesStatus, to: SeriesStatus): SeriesStatus {
  if (!canTransitionSeries(from, to)) throw new TransitionError('series', from, to);
  return to;
}

/** Which gate unlocks which status. */
export const GATE_EFFECTS = {
  G1: { series: 'bible_approved' },
  G2: { series: 'assets_locked' },
  G3: { episode: 'draft_approved' },
  G4: { episode: 'final_ready' },
} as const;
