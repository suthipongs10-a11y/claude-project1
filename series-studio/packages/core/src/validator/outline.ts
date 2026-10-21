import type { Outline, Series } from '../schemas/index.js';
import { error, makeReport, warning, type Issue, type ValidationReport } from '../util/result.js';

export interface OutlineValidationOptions {
  /** Allowed deviation of summed est_sec from ep_length_sec (0.05 = ±5%). */
  lengthTolerance?: number;
}

/**
 * SPEC §8.1 rules: every episode opens with a hook and ends with a cliffhanger; in product
 * mode the `bridge` beat appears only in the designated episodes.
 */
export function validateOutline(
  outline: Outline,
  series: Pick<Series, 'episodes' | 'ep_length_sec' | 'product'>,
  opts: OutlineValidationOptions = {},
): ValidationReport {
  const issues: Issue[] = [];
  const at = `ep${outline.episode}`;

  if (outline.episode > series.episodes)
    issues.push(error('outline.episode_out_of_range', `ตอนที่ ${outline.episode} เกินจำนวนตอนของซีรีส์ (${series.episodes})`, at));

  const first = outline.beats[0];
  const last = outline.beats[outline.beats.length - 1];
  if (first && first.type !== 'hook') issues.push(error('outline.no_hook', 'จังหวะแรกต้องเป็น hook (ดึงคนดูภายใน 3 วินาทีแรก)', `${at}/beats[0]`));
  if (last && last.type !== 'cliffhanger') issues.push(error('outline.no_cliffhanger', 'จังหวะสุดท้ายต้องเป็น cliffhanger', `${at}/beats[${outline.beats.length - 1}]`));

  const ids = new Set<string>();
  for (const b of outline.beats) {
    if (ids.has(b.id)) issues.push(error('outline.duplicate_beat', `beat id "${b.id}" ซ้ำ`, `${at}/${b.id}`));
    ids.add(b.id);
  }

  const middle = outline.beats.length - 2;
  if (middle < 3) issues.push(warning('outline.too_few_beats', `มีจังหวะกลางเรื่องแค่ ${Math.max(0, middle)} จังหวะ (SPEC แนะนำ 5 จังหวะ + cliffhanger)`, at));
  if (middle > 8) issues.push(warning('outline.too_many_beats', `มีจังหวะมากถึง ${middle} จังหวะ อาจแน่นเกินสำหรับตอนสั้น`, at));

  const bridges = outline.beats.filter((b) => b.type === 'bridge');
  if (series.product) {
    const designated = series.product.bridge_episodes.includes(outline.episode);
    if (designated && bridges.length === 0)
      issues.push(error('outline.bridge_required', `ตอนที่ ${outline.episode} อยู่ใน product.bridge_episodes ต้องมีจังหวะ bridge (สะพานสู่สินค้า)`, at));
    if (!designated && bridges.length > 0)
      issues.push(error('outline.bridge_not_allowed', `ตอนที่ ${outline.episode} ไม่ได้กำหนดให้มีสินค้า แต่มีจังหวะ bridge`, at));
  } else if (bridges.length > 0) {
    issues.push(error('outline.bridge_without_product', 'ซีรีส์นี้ไม่ได้เปิด product mode แต่มีจังหวะ bridge', at));
  }

  const withEst = outline.beats.filter((b) => b.est_sec !== undefined);
  if (withEst.length === outline.beats.length && outline.beats.length > 0) {
    const total = withEst.reduce((s, b) => s + (b.est_sec ?? 0), 0);
    const tol = opts.lengthTolerance ?? 0.05;
    const diff = Math.abs(total - series.ep_length_sec) / series.ep_length_sec;
    if (diff > tol)
      issues.push(
        warning(
          'outline.length_mismatch',
          `เวลารวมของจังหวะ ${total.toFixed(1)} วินาที ต่างจากความยาวตอน ${series.ep_length_sec} วินาที เกิน ${Math.round(tol * 100)}%`,
          at,
        ),
      );
  }

  return makeReport(issues);
}
