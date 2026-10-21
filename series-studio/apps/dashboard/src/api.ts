/** Tiny API client. Token comes from ?token= on first load and is kept in localStorage. */
const KEY = 'series-studio.token';

export function getToken(): string {
  const url = new URL(window.location.href);
  const q = url.searchParams.get('token');
  if (q) {
    localStorage.setItem(KEY, q);
    url.searchParams.delete('token');
    window.history.replaceState({}, '', url.toString());
    return q;
  }
  return localStorage.getItem(KEY) ?? '';
}

export function setToken(t: string): void {
  localStorage.setItem(KEY, t);
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly body?: unknown) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${getToken()}` } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(path, init);
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error ?? `${res.status} ${res.statusText}`;
    throw new ApiError(msg, res.status, data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => call<T>('GET', path),
  post: <T>(path: string, body?: unknown) => call<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => call<T>('PUT', path, body ?? {}),
};

/** URL of a media file inside projects/<series>/ (token in query because <img>/<video> cannot set headers). */
export function fileUrl(seriesId: string, rel: string): string {
  return `/files/${encodeURIComponent(seriesId)}/${rel.split('/').map(encodeURIComponent).join('/')}?token=${encodeURIComponent(getToken())}`;
}

export function epTag(n: number): string {
  return `ep${String(n).padStart(2, '0')}`;
}

// ---- shared types (mirrors core schemas loosely; the server validates) ----
export interface SeriesRow {
  id: string;
  title: string;
  logline: string;
  style_id: string;
  aspect: '9:16' | '16:9';
  episodes: number;
  ep_length_sec: number;
  status: string;
  gates: { G1: { approved: boolean }; G2: { approved: boolean } };
  product: { name: string; bridge_episodes: number[] } | null;
  cost?: { total_credits: number } | null;
}
export interface EntityRow { id: string; name: string; locked: boolean; refs: number; version: number }
export interface EpisodeRow {
  episode: number;
  title: string | null;
  status: string;
  has_outline: boolean;
  has_script: boolean;
  shots: number;
  batches: number;
  qc: { pass: number; fail: number };
  gates: { G3: { approved: boolean }; G4: { approved: boolean } };
  jobs: Record<string, number>;
  final: string[];
}
export interface SeriesSummary {
  series: SeriesRow;
  bible: { characters: EntityRow[]; locations: EntityRow[]; props: EntityRow[]; voices: string[] } | null;
  episodes: EpisodeRow[];
  cost: { episodes: Record<string, { credits: number; jobs: number }>; total_credits: number };
  next_gate: 'G1' | 'G2' | null;
  next_gate_check: { ok: boolean; blockers: string[]; warnings: string[] } | null;
}
export interface Shot {
  id: string; scene: number; batch: string | null; duration_sec: number; type: string; movement: string; lens: string;
  characters: Array<{ id: string; emotion: string; screen_pos: string }>; location: string; time: string; action: string; purpose: string; beat: string;
  dialogue: Array<{ char: string; text: string; t_start: number; t_end: number }>;
}
export interface QcRes { shot_id: string; version: number; pass: boolean; reasons: string[]; checks: Array<{ name: string; pass: boolean; skipped: boolean; detail?: string }>; review?: { pass: boolean; reason: string; by: string } }
export interface Job { id: string; kind: string; episode?: number; batch_id?: string; entity_id?: string; status: string; attempt: number; quality: string; output?: string; cost_credits: number; fix_notes?: string; created_at: string }
export interface EpisodeDetail {
  episode: number;
  state: { status: string; gates: { G3: { approved: boolean }; G4: { approved: boolean } } };
  outline: { title: string; synopsis: string; beats: Array<{ id: string; type: string; summary: string }> } | null;
  shots: { shots: Shot[] } | null;
  batches: Array<{ id: string; shot_ids: string[]; total_sec: number; prompt: string }>;
  qc: Record<string, QcRes>;
  gen: Record<string, { clip: string; version: number; frames: string[]; offset_sec: number }>;
  jobs: Job[];
  previews: string[];
  finals: string[];
  comments: Array<{ t_sec: number; text: string; shot_id?: string; at: string }>;
  timeline: { total_sec: number; segments: Array<{ kind: string; id: string; start_sec: number; in_sec: number; out_sec: number; shot_ids: string[] }> } | null;
}
export interface Bible {
  characters: Array<{ id: string; name: string; role: string; look: string; wardrobe_default: string; refs: string[]; locked: boolean; ref_version: number }>;
  locations: Array<{ id: string; name: string; look?: string; refs: string[]; locked: boolean; ref_version: number; time_variants: string[] }>;
  props: Array<{ id: string; name: string; look: string; refs: string[]; locked: boolean; ref_version: number; is_product: boolean }>;
}
export interface StyleRow { id: string; label: string; medium: string; dialogue_mode: string; aspect_modes: string[]; notes?: string }
