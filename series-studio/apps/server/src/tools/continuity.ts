import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CharacterState, EpisodeNumber, Slug } from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { ContinuityService } from '../services/continuity.js';
import { CostService } from '../services/cost.js';
import { fail, guarded, ok } from './_helpers.js';
import { reportText } from './_report.js';

export function registerContinuityTools(server: McpServer, ctx: StudioContext): void {
  const continuity = new ContinuityService(ctx);
  const cost = new CostService(ctx);

  server.registerTool(
    'update_continuity',
    {
      title: 'บันทึก continuity ท้ายตอน',
      description:
        'Record each character\'s state at the end of an episode (continuity.json). By default wardrobe is derived from each character\'s last shot and injury/holding/appearance/state are carried from the previous episode; ' +
        'pass `states` to override fields (empty string clears a field, e.g. a healed injury). The next episode\'s write_shots/compile_prompts enforce and inject this state.',
      inputSchema: z.object({
        series_id: Slug,
        episode: EpisodeNumber.describe('State AFTER this episode'),
        states: z.record(Slug, CharacterState).optional(),
        notes: z.string().optional(),
        auto: z.boolean().default(true),
      }),
    },
    guarded(ctx.log, 'update_continuity', ({ series_id, episode, states, notes, auto }) => {
      const res = continuity.update(series_id, episode, { states, notes, auto });
      if (!res.report.ok) return fail(`update_continuity ไม่ได้บันทึก:\n${reportText(res.report)}`, { report: res.report });
      const lines = Object.entries(res.entry.states).map(([id, st]) => `- ${id}: ชุด ${st.wardrobe ?? '-'}${st.injury ? `, แผล ${st.injury}` : ''}${st.holding ? `, ถือ ${st.holding}` : ''}${st.appearance ? `, ${st.appearance}` : ''}${st.state ? `, สถานะ ${st.state}` : ''}`);
      return ok({ entry: res.entry, report: res.report }, `บันทึก continuity หลังตอนที่ ${episode} แล้ว:\n${lines.join('\n') || '(ไม่มีตัวละครในตอน)'}\n${reportText(res.report)}`);
    }),
  );

  server.registerTool(
    'cost_report',
    {
      title: 'รายงานเครดิต',
      description: 'Credits per episode (from cost.json and the job table) versus the all-final-quality baseline, with the savings percentage (SPEC §15 target ≥ 30%).',
      inputSchema: z.object({ series_id: Slug }),
      annotations: { readOnlyHint: true },
    },
    guarded(ctx.log, 'cost_report', ({ series_id }) => {
      const r = cost.report(series_id);
      const rows = r.episodes.map((e) => `- ตอน ${e.episode}: ${e.credits} เครดิต / ${e.jobs} งาน (draft ${e.clip_jobs.draft}, final ${e.clip_jobs.final}, เจนซ่อม ${e.clip_jobs.regen}, พัง ${e.clip_jobs.failed}) · baseline ${e.baseline_all_final}`);
      const text =
        `เครดิตซีรีส์ ${series_id} (engine ${r.engine_id}: draft ${r.credits_per_clip.draft} / final ${r.credits_per_clip.final} ต่อคลิป)\n${rows.join('\n')}\n` +
        `รวม ${r.total_credits} เครดิต · baseline เจน final ทุก batch ครั้งเดียว ${r.total_baseline}` +
        (r.savings_pct !== null ? ` · ประหยัด ${r.savings_pct}%${r.savings_pct >= 30 ? ' ✅ (เป้า ≥30%)' : ' (เป้า ≥30%)'}` : '') +
        ` · งาน ref ${r.ref_jobs}`;
      return ok({ ...r }, text);
    }),
  );
}
