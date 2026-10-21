import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Outline, Slug, validateOutline } from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { SeriesService } from '../services/series.js';
import { fail, guarded, ok } from './_helpers.js';
import { reportText } from './_report.js';

export function registerOutlineTools(server: McpServer, ctx: StudioContext): void {
  const svc = new SeriesService(ctx);

  server.registerTool(
    'write_outline',
    {
      title: 'เขียน outline ตอน',
      description:
        'Write the beat outline of one episode (outline.json). Rules checked by code: first beat = hook, last beat = cliffhanger, ' +
        'product `bridge` beats only in product.bridge_episodes, total est_sec within tolerance of ep_length_sec.',
      inputSchema: Outline.extend({ series_id: Slug }),
    },
    guarded(ctx.log, 'write_outline', ({ series_id, ...outline }) => {
      const series = svc.load(series_id);
      svc.requireEpisode(series, outline.episode);
      const parsed = Outline.parse(outline);
      const report = validateOutline(parsed, series, { lengthTolerance: ctx.config.script.episode_length_tolerance });
      if (!report.ok) return fail(`write_outline ตอนที่ ${outline.episode} ไม่ได้บันทึก:\n${reportText(report)}`, { report });
      ctx.store.writeJson(svc.outlineFile(series_id, outline.episode), parsed);
      const remaining = [];
      for (let n = 1; n <= series.episodes; n++) if (!svc.loadOutline(series_id, n)) remaining.push(n);
      return ok(
        { report, file: `episodes/ep${String(outline.episode).padStart(2, '0')}/outline.json`, episodes_without_outline: remaining },
        `บันทึก outline ตอนที่ ${outline.episode} "${parsed.title}" แล้ว (${parsed.beats.length} จังหวะ)\n${reportText(report)}` +
          (remaining.length ? `\nตอนที่ยังไม่มี outline: ${remaining.join(', ')}` : '\nทุกตอนมี outline แล้ว → approve_gate G1 เมื่อผู้ใช้อนุมัติเรื่อง'),
      );
    }),
  );
}
