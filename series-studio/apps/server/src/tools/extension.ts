import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Slug } from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { SeriesService } from '../services/series.js';
import { fail, guarded, ok } from './_helpers.js';

export function registerExtensionTools(server: McpServer, ctx: StudioContext): void {
  server.registerTool(
    'extension_status',
    {
      title: 'สถานะ Chrome Extension',
      description: 'Whether the Flow Chrome extension is paired/connected, the active job, queued flow_ext jobs, and whether the queue is halted on an unknown page. Pass resume=true after fixing the page/selectors.',
      inputSchema: z.object({ resume: z.boolean().optional() }),
    },
    guarded(ctx.log, 'extension_status', ({ resume }) => {
      if (!ctx.ext) return fail('HTTP server ไม่ได้รัน (http.enabled=false) extension จึงเชื่อมต่อไม่ได้');
      if (resume) ctx.ext.resume();
      const st = ctx.ext.status();
      const text =
        `Extension: ${st.connected ? `เชื่อมต่อแล้ว (v${st.version ?? '?'} ตั้งแต่ ${st.connected_at ?? '?'})` : 'ยังไม่เชื่อมต่อ — เปิด Chrome ที่ติดตั้ง extension แล้วใส่ token จาก dashboard_info'}\n` +
        `งานที่ทำอยู่: ${st.active_job ?? 'ไม่มี'} · รอคิว flow_ext: ${st.queued}` +
        (st.halted ? `\n⚠️ คิวหยุดอยู่: ${st.halted}\nแก้หน้า Flow หรือ config/flow-selectors.json แล้วเรียก extension_status resume=true` : '');
      return ok({ ...st }, text);
    }),
  );

  server.registerTool(
    'sync_flow_characters',
    {
      title: 'สร้าง Characters ใน Flow',
      description: 'Queue flow_ext jobs that create a Flow Character (from the locked reference images) for every locked character without flow_character_id. The extension saves the id back into the bible.',
      inputSchema: z.object({ series_id: Slug, character_ids: z.array(Slug).optional() }),
    },
    guarded(ctx.log, 'sync_flow_characters', ({ series_id, character_ids }) => {
      const svc = new SeriesService(ctx);
      const series = svc.load(series_id);
      const all = svc.listEntities(series_id, 'character');
      const targets = all.filter((c) => (!character_ids || character_ids.includes(c.id)) && c.locked && !c.flow_character_id);
      const skipped = all.filter((c) => (!character_ids || character_ids.includes(c.id)) && !targets.includes(c)).map((c) => `${c.id}: ${!c.locked ? 'ยังไม่ lock' : 'มี flow_character_id แล้ว'}`);
      const now = ctx.now();
      const jobs = targets.map((c) =>
        ctx.jobs.create({
          kind: 'character',
          series_id,
          entity_type: 'character',
          entity_id: c.id,
          quality: 'final',
          engine_id: 'flow_ext',
          status: 'queued',
          attempt: 1,
          prompt: `Create a Flow character named "${c.id}" from the attached reference images. Appearance: ${c.look}; default wardrobe: ${c.wardrobe_default}.`,
          shot_ids: [],
          ref_images: c.refs,
          cost_credits: 0,
          created_at: now,
          updated_at: now,
        }),
      );
      ctx.ext?.pump();
      void series;
      return ok(
        { job_ids: jobs.map((j) => j.id), skipped },
        `สร้างงาน Flow Character ${jobs.length} งาน: ${jobs.map((j) => `${j.entity_id}→${j.id}`).join(', ') || 'ไม่มี'}` + (skipped.length ? `\nข้าม: ${skipped.join('; ')}` : '') + (ctx.ext?.status().connected ? '' : '\n(extension ยังไม่เชื่อมต่อ งานจะรอคิว)'),
      );
    }),
  );
}
