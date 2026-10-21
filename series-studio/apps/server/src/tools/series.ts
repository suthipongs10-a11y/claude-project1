import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Aspect, EpisodeNumber, Product, Slug } from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { SeriesService } from '../services/series.js';
import { guarded, ok } from './_helpers.js';
import { summarizeSeries } from './_summary.js';

export function registerSeriesTools(server: McpServer, ctx: StudioContext): void {
  const svc = new SeriesService(ctx);

  server.registerTool(
    'list_series',
    {
      title: 'รายการซีรีส์',
      description: 'List all series in projects/ with status and gate state.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    guarded(ctx.log, 'list_series', () => {
      const series = svc.list().map((s) => ({ id: s.id, title: s.title, style_id: s.style_id, aspect: s.aspect, episodes: s.episodes, status: s.status, gates: s.gates }));
      const text = series.length
        ? `ซีรีส์ ${series.length} เรื่อง:\n${series.map((s) => `- ${s.id}: ${s.title} [${s.style_id}, ${s.episodes} ตอน, สถานะ ${s.status}]`).join('\n')}`
        : 'ยังไม่มีซีรีส์ ใช้ create_series เพื่อสร้าง';
      return ok({ series }, text);
    }),
  );

  server.registerTool(
    'create_series',
    {
      title: 'สร้างซีรีส์',
      description:
        'Create a new series folder (projects/<id>/) with series.json, continuity.json, cost.json and the episode skeleton. ' +
        'One style per series. Returns series_id. Next: write_bible, then write_outline for every episode, then approve_gate G1.',
      inputSchema: z.object({
        id: Slug.optional().describe('Series slug (a-z0-9_-). Required when the title has no latin letters.'),
        title: z.string().min(1),
        logline: z.string().min(1),
        style_id: Slug.describe('Preset id from list_styles'),
        aspect: Aspect,
        episodes: EpisodeNumber.describe('Number of episodes in the season'),
        ep_length_sec: z.number().positive().describe('Target length per episode in seconds'),
        product: Product.optional().describe('Product mode settings; the product must later be added as a prop with is_product=true'),
        engine_id: z.string().min(1).optional().describe('Video engine id from config (default: manual)'),
      }),
    },
    guarded(ctx.log, 'create_series', (args) => {
      const series = svc.create({ ...args, product: args.product ?? null });
      return ok(
        { series_id: series.id, series, next: ['write_bible', 'write_outline (ทุกตอน)', 'approve_gate G1'] },
        `สร้างซีรีส์ "${series.title}" แล้ว (id: ${series.id}, ${series.episodes} ตอน × ${series.ep_length_sec} วิ, สไตล์ ${series.style_id}, ${series.aspect})\n` +
          `ขั้นต่อไป: write_bible → write_outline ทุกตอน → approve_gate G1`,
      );
    }),
  );

  server.registerTool(
    'get_series',
    {
      title: 'สถานะซีรีส์',
      description: 'Full status of a series: bible entities with lock state, per-episode progress, gates, jobs and cost.',
      inputSchema: z.object({ series_id: Slug }),
      annotations: { readOnlyHint: true },
    },
    guarded(ctx.log, 'get_series', ({ series_id }) => {
      const summary = summarizeSeries(ctx, series_id);
      return ok(summary.data, summary.text);
    }),
  );
}
