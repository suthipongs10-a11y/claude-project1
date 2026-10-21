import { join } from 'node:path';
import { Cost, QcResult, ShotList } from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { SeriesService } from '../services/series.js';
import { GateService } from '../services/gates.js';

/** One place that knows how to describe a series' state (used by get_series and the dashboard). */
export function summarizeSeries(ctx: StudioContext, seriesId: string): { data: Record<string, unknown>; text: string } {
  const svc = new SeriesService(ctx);
  const gates = new GateService(ctx);
  const series = svc.load(seriesId);
  const bible = svc.loadBible(seriesId);
  const ent = (list: Array<{ id: string; name: string; locked: boolean; refs: string[]; ref_version: number }>) =>
    list.map((e) => ({ id: e.id, name: e.name, locked: e.locked, refs: e.refs.length, version: e.ref_version }));
  const episodes = [];
  for (let n = 1; n <= series.episodes; n++) {
    const state = svc.loadEpisodeState(seriesId, n);
    const outline = svc.loadOutline(seriesId, n);
    const shotsFile = ctx.store.episodePath(seriesId, n, 'shots.json');
    const shots = ctx.store.exists(shotsFile) ? ctx.store.readJson(shotsFile, ShotList, 'shots.json') : undefined;
    let qcPass = 0;
    let qcFail = 0;
    if (shots) {
      for (const s of shots.shots) {
        const f = join(ctx.store.episodePath(seriesId, n, 'qc'), `${s.id}.json`);
        if (!ctx.store.exists(f)) continue;
        const r = ctx.store.readJson(f, QcResult, 'qc');
        if (r.pass || r.review?.pass) qcPass++;
        else qcFail++;
      }
    }
    episodes.push({
      episode: n,
      title: outline?.title ?? null,
      status: state.status,
      has_outline: outline !== undefined,
      has_script: ctx.store.exists(ctx.store.episodePath(seriesId, n, 'script.json')),
      shots: shots?.shots.length ?? 0,
      batches: ctx.store.listFiles(ctx.store.episodePath(seriesId, n, 'batches'), '.json').length,
      qc: { pass: qcPass, fail: qcFail },
      gates: state.gates,
      jobs: ctx.jobs.counts(seriesId, n),
      final: ctx.store.listFiles(ctx.store.episodePath(seriesId, n, 'final'), '.mp4'),
    });
  }
  const cost = ctx.store.readJsonIfExists(join(ctx.store.seriesDir(seriesId), 'cost.json'), Cost, 'cost.json') ?? Cost.parse({});
  const nextGate = !series.gates.G1.approved ? 'G1' : !series.gates.G2.approved ? 'G2' : null;
  const gateCheck = nextGate ? gates.check(series, nextGate) : null;
  const data = {
    series,
    bible: bible
      ? { characters: ent(bible.characters), locations: ent(bible.locations), props: ent(bible.props), voices: Object.keys(bible.voices) }
      : null,
    episodes,
    cost,
    next_gate: nextGate,
    next_gate_check: gateCheck,
  };
  const lines = [
    `ซีรีส์ "${series.title}" (${series.id}) สไตล์ ${series.style_id} ${series.aspect} ${series.episodes} ตอน × ${series.ep_length_sec} วิ สถานะ: ${series.status}`,
    `Gate: G1 ${series.gates.G1.approved ? '✅' : '⏳'} · G2 ${series.gates.G2.approved ? '✅' : '⏳'}`,
    bible
      ? `Bible: ตัวละคร ${bible.characters.length} (lock ${bible.characters.filter((c) => c.locked).length}), ฉาก ${bible.locations.length} (lock ${bible.locations.filter((l) => l.locked).length}), ของ ${bible.props.length} (lock ${bible.props.filter((p) => p.locked).length})`
      : 'Bible: ยังไม่มี',
    ...episodes.map(
      (e) =>
        `ตอน ${e.episode}${e.title ? ` "${e.title}"` : ''}: ${e.status} | outline ${e.has_outline ? '✓' : '–'} script ${e.has_script ? '✓' : '–'} shots ${e.shots} batches ${e.batches} QC ✓${e.qc.pass} ✗${e.qc.fail} | G3 ${e.gates.G3.approved ? '✅' : '⏳'} G4 ${e.gates.G4.approved ? '✅' : '⏳'}`,
    ),
    gateCheck && !gateCheck.ok ? `ก่อนอนุมัติ ${nextGate} ต้องแก้: ${gateCheck.blockers.slice(0, 8).join('; ')}${gateCheck.blockers.length > 8 ? ` …อีก ${gateCheck.blockers.length - 8} ข้อ` : ''}` : gateCheck ? `พร้อมอนุมัติ ${nextGate}` : '',
  ].filter(Boolean);
  return { data, text: lines.join('\n') };
}
