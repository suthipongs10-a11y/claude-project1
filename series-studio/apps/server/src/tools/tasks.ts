import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { StudioContext } from '../context.js';
import { fail, guarded, ok } from './_helpers.js';
import { renderTask } from './_tasks.js';
import { renderers } from './_renderers.js';

export function registerTaskTools(server: McpServer, ctx: StudioContext): void {
  server.registerTool(
    'task_status',
    {
      title: 'สถานะงานเบื้องหลัง',
      description: 'Status/result of a long-running task started by assemble, run_qc or dub_episode (they return a task_id when they take longer than their wait budget). Pass wait_sec to block up to that long for completion. Without task_id, lists running tasks.',
      inputSchema: z.object({ task_id: z.string().min(1).optional(), wait_sec: z.int().min(0).max(55).default(0) }),
      annotations: { readOnlyHint: true },
    },
    guarded(ctx.log, 'task_status', async ({ task_id, wait_sec }) => {
      if (!task_id) {
        const running = ctx.tasks.list({ status: 'running' });
        return ok({ tasks: running }, running.length ? `งานที่กำลังทำ ${running.length} งาน:\n${running.map((t) => `- ${t.id}: ${t.label}${t.progress ? ` (${t.progress})` : ''}`).join('\n')}` : 'ไม่มีงานเบื้องหลังที่กำลังทำ');
      }
      const t = (await ctx.tasks.waitFor(task_id, wait_sec * 1000)) ?? ctx.tasks.get(task_id);
      if (!t) return fail(`ไม่พบ task ${task_id} (อาจหมดอายุหรือ server รีสตาร์ท)`);
      return renderTask(t, renderers[t.kind]);
    }),
  );
}
