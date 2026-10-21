import { join } from 'node:path';
import {
  QcResult,
  ShotList,
  transitionEpisode,
  transitionSeries,
  validateBible,
  validateOutline,
  type GateId,
  type Series as SeriesT,
} from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { SeriesService } from './series.js';

export interface GateCheck {
  ok: boolean;
  blockers: string[];
  warnings: string[];
}

/** Gate preconditions are code, so a gate can never be approved on an incomplete state. */
export class GateService {
  private readonly series: SeriesService;

  constructor(private readonly ctx: StudioContext) {
    this.series = new SeriesService(ctx);
  }

  check(series: SeriesT, gate: GateId, episode?: number): GateCheck {
    const blockers: string[] = [];
    const warnings: string[] = [];
    const bible = this.series.loadBible(series.id);

    if (gate === 'G1' || gate === 'G2') {
      if (!bible) blockers.push('ยังไม่มี bible (ใช้ write_bible)');
      else {
        const r = validateBible(bible, series, { requireRefs: gate === 'G2' });
        blockers.push(...r.errors.map((e) => `${e.at ?? ''} ${e.message}`.trim()));
        warnings.push(...r.warnings.map((w) => `${w.at ?? ''} ${w.message}`.trim()));
      }
    }

    if (gate === 'G1') {
      for (let n = 1; n <= series.episodes; n++) {
        const outline = this.series.loadOutline(series.id, n);
        if (!outline) {
          blockers.push(`ตอนที่ ${n} ยังไม่มี outline (ใช้ write_outline)`);
          continue;
        }
        const r = validateOutline(outline, series, { lengthTolerance: this.ctx.config.script.episode_length_tolerance });
        blockers.push(...r.errors.map((e) => `${e.at ?? ''} ${e.message}`.trim()));
        warnings.push(...r.warnings.map((w) => `${w.at ?? ''} ${w.message}`.trim()));
      }
    }

    if (gate === 'G2') {
      if (!series.gates.G1.approved) blockers.push('ต้องอนุมัติ G1 (เรื่อง) ก่อน');
      if (bible) {
        for (const [label, list] of [
          ['ตัวละคร', bible.characters],
          ['ฉาก', bible.locations],
          ['ของ', bible.props],
        ] as const) {
          for (const e of list) {
            if (!e.locked) blockers.push(`${label} "${e.id}" ยังไม่ lock`);
            else if (e.refs.length === 0) blockers.push(`${label} "${e.id}" lock แล้วแต่ไม่มี ref`);
          }
        }
        if (series.product && !bible.props.some((p) => p.id === series.product?.prop_id && p.locked))
          blockers.push(`สินค้า "${series.product.prop_id}" ยังไม่ lock`);
      }
    }

    if (gate === 'G3' || gate === 'G4') {
      if (episode === undefined) blockers.push(`gate ${gate} ต้องระบุตอน (episode)`);
      else {
        this.series.requireEpisode(series, episode);
        if (!series.gates.G2.approved) blockers.push('ต้องอนุมัติ G2 (ล็อก asset) ก่อน');
        const state = this.series.loadEpisodeState(series.id, episode);
        if (gate === 'G3') {
          const shotsFile = this.ctx.store.episodePath(series.id, episode, 'shots.json');
          if (!this.ctx.store.exists(shotsFile)) blockers.push(`ตอนที่ ${episode} ยังไม่มี shots.json`);
          else {
            const shots = this.ctx.store.readJson(shotsFile, ShotList, 'shots.json');
            const qcDir = this.ctx.store.episodePath(series.id, episode, 'qc');
            for (const s of shots.shots) {
              const f = join(qcDir, `${s.id}.json`);
              if (!this.ctx.store.exists(f)) blockers.push(`ช็อต ${s.id} ยังไม่มีผล QC`);
              else {
                const qc = this.ctx.store.readJson(f, QcResult, `qc/${s.id}.json`);
                if (!qc.pass && !(qc.review?.pass === true)) blockers.push(`ช็อต ${s.id} ไม่ผ่าน QC: ${qc.reasons.join('; ') || 'ไม่ระบุเหตุผล'}`);
              }
            }
          }
          if (!['qc', 'generating', 'draft_approved'].includes(state.status)) warnings.push(`สถานะตอนคือ "${state.status}" (ปกติควรเป็น qc)`);
        } else {
          if (!state.gates.G3.approved) blockers.push('ต้องอนุมัติ G3 (ดราฟต์) ก่อน');
          const finalDir = this.ctx.store.episodePath(series.id, episode, 'final');
          if (this.ctx.store.listFiles(finalDir, '.mp4').length === 0) blockers.push(`ตอนที่ ${episode} ยังไม่มีไฟล์ final/*.mp4 (ใช้ assemble)`);
        }
      }
    }

    return { ok: blockers.length === 0, blockers, warnings };
  }

  approve(seriesId: string, gate: GateId, opts: { episode?: number | undefined; note?: string | undefined; via?: 'chat' | 'dashboard' | undefined }): {
    series: SeriesT;
    check: GateCheck;
  } {
    let series = this.series.load(seriesId);
    const check = this.check(series, gate, opts.episode);
    if (!check.ok) return { series, check };
    const now = this.ctx.now();
    const approval = { approved: true, at: now, via: opts.via ?? 'chat', ...(opts.note ? { note: opts.note } : {}) };
    if (gate === 'G1' || gate === 'G2') {
      const status = transitionSeries(series.status, gate === 'G1' ? 'bible_approved' : 'assets_locked');
      series = this.series.save({ ...series, status, gates: { ...series.gates, [gate]: approval } });
    } else {
      const n = opts.episode as number;
      const state = this.series.loadEpisodeState(seriesId, n);
      const target = gate === 'G3' ? 'draft_approved' : 'final_ready';
      const status = state.status === target ? target : transitionEpisode(state.status === 'generating' ? 'qc' : state.status, target);
      this.series.saveEpisodeState(seriesId, {
        ...state,
        status,
        gates: { ...state.gates, [gate]: { approved: true, at: now, ...(opts.note ? { note: opts.note } : {}) } },
      });
      if (series.status === 'assets_locked') series = this.series.save({ ...series, status: 'production' });
    }
    this.ctx.log.info('gate_approved', { series_id: seriesId, gate, episode: opts.episode ?? null, via: opts.via ?? 'chat' });
    this.ctx.emit({ type: 'gate', series_id: seriesId, ...(opts.episode !== undefined ? { episode: opts.episode } : {}), gate });
    return { series, check };
  }
}
