import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { EpisodeNumber, GateId, Slug } from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { GateService } from '../services/gates.js';
import { SeriesService } from '../services/series.js';
import { fail, guarded, ok } from './_helpers.js';

const GATE_LABEL: Record<string, string> = { G1: 'อนุมัติเรื่อง (bible + outline)', G2: 'อนุมัติและล็อก asset', G3: 'อนุมัติดราฟต์ตอน', G4: 'อนุมัติไฟล์จบ + export' };

export function registerGateTools(server: McpServer, ctx: StudioContext): void {
  const gates = new GateService(ctx);
  const series = new SeriesService(ctx);

  server.registerTool(
    'check_gate',
    {
      title: 'ตรวจความพร้อมของ gate',
      description: 'Dry-run the code preconditions of a gate without approving it.',
      inputSchema: z.object({ series_id: Slug, gate: GateId, episode: EpisodeNumber.optional() }),
      annotations: { readOnlyHint: true },
    },
    guarded(ctx.log, 'check_gate', ({ series_id, gate, episode }) => {
      const check = gates.check(series.load(series_id), gate, episode);
      return ok({ gate, check }, check.ok ? `${gate} พร้อมอนุมัติ${check.warnings.length ? `\nคำเตือน: ${check.warnings.join('; ')}` : ''}` : `${gate} ยังอนุมัติไม่ได้:\n- ${check.blockers.join('\n- ')}`);
    }),
  );

  server.registerTool(
    'approve_gate',
    {
      title: 'อนุมัติ gate',
      description:
        'Record the user\'s approval of a gate: G1 story, G2 assets locked, G3 episode draft (needs episode), G4 final (needs episode). ' +
        'Only call after the user explicitly approved in chat. Code preconditions must pass.',
      inputSchema: z.object({
        series_id: Slug,
        gate: GateId,
        episode: EpisodeNumber.optional(),
        note: z.string().optional(),
        via: z.enum(['chat', 'dashboard']).optional(),
      }),
    },
    guarded(ctx.log, 'approve_gate', ({ series_id, gate, episode, note, via }) => {
      const res = gates.approve(series_id, gate, { episode, note, via });
      if (!res.check.ok) return fail(`${gate} (${GATE_LABEL[gate]}) ยังอนุมัติไม่ได้:\n- ${res.check.blockers.join('\n- ')}`, { check: res.check });
      return ok(
        { gate, episode: episode ?? null, series_status: res.series.status, warnings: res.check.warnings },
        `อนุมัติ ${gate} (${GATE_LABEL[gate]})${episode ? ` ตอนที่ ${episode}` : ''} แล้ว สถานะซีรีส์: ${res.series.status}` +
          (res.check.warnings.length ? `\nคำเตือน: ${res.check.warnings.join('; ')}` : ''),
      );
    }),
  );
}
