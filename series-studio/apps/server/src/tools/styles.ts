import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { summarizePreset } from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { fail, guarded, ok } from './_helpers.js';

export function registerStyleTools(server: McpServer, ctx: StudioContext): void {
  server.registerTool(
    'list_styles',
    {
      title: 'รายการสไตล์',
      description:
        'List available style presets (presets/styles/*.json). Pass `id` to get the full preset. ' +
        'A series uses exactly one style for all episodes and all reference images.',
      inputSchema: z.object({
        id: z.string().min(1).optional().describe('Preset id to return in full, e.g. "live_kdrama_dub"'),
        reload: z.boolean().optional().describe('Re-read preset files from disk first'),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    guarded(ctx.log, 'list_styles', ({ id, reload }) => {
      if (reload) ctx.reloadPresets();
      if (id !== undefined) {
        const p = ctx.presets.get(id);
        if (!p) {
          return fail(`ไม่พบสไตล์ "${id}" สไตล์ที่มี: ${[...ctx.presets.keys()].join(', ') || '(ไม่มี)'}`);
        }
        return ok({ preset: p });
      }
      const styles = [...ctx.presets.values()].map(summarizePreset);
      const errors = [...ctx.presetErrors.entries()].map(([file, error]) => ({ file, error }));
      const lines = styles.map((s) => `- ${s.id}: ${s.label} [${s.medium}, เสียง: ${s.dialogue_mode}, ${s.aspect_modes.join('/')}]`);
      const text =
        (lines.length ? `สไตล์ที่มี ${styles.length} แบบ:\n${lines.join('\n')}` : 'ยังไม่มีสไตล์ใน presets/styles/') +
        (errors.length ? `\n\nไฟล์ preset ที่โหลดไม่ได้:\n${errors.map((e) => `- ${e.file}: ${e.error}`).join('\n')}` : '');
      return ok({ count: styles.length, styles, errors }, text);
    }),
  );
}
