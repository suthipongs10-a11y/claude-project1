import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { EpisodeNumber, Slug } from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { QcService } from '../services/qc.js';
import { guarded, ok } from './_helpers.js';

export function registerQcTools(server: McpServer, ctx: StudioContext): void {
  const svc = new QcService(ctx);

  server.registerTool(
    'run_qc',
    {
      title: 'ตรวจคุณภาพอัตโนมัติ',
      description:
        'Run the QC worker on imported clips of an episode (default: all shots with a clip): clip duration, scene cuts vs shot list, black/frozen frames, ' +
        'dialogue CER (native mode, needs faster-whisper), identity similarity vs refs (needs insightface/open_clip), people count (needs opencv). ' +
        'Missing libraries make a check "skipped", never a failure. Writes qc/<shot>.json. auto_regen queues fixes for failed shots up to qc.max_regen_attempts.',
      inputSchema: z.object({ series_id: Slug, episode: EpisodeNumber, shot_ids: z.array(Slug).optional(), auto_regen: z.boolean().default(false) }),
    },
    guarded(ctx.log, 'run_qc', async ({ series_id, episode, shot_ids, auto_regen }) => {
      const res = await svc.runQc(series_id, episode, { shot_ids, auto_regen });
      const lines = res.results.map((r) => `- ${r.shot_id} v${r.version}: ${r.pass ? '✅ ผ่าน' : `❌ ${r.reasons.join('; ')}`}${r.review ? ` (review: ${r.review.pass ? 'ผ่าน' : 'ไม่ผ่าน'} โดย ${r.review.by})` : ''}`);
      const text =
        `QC ตอนที่ ${episode}: ผ่าน ${res.summary.pass}/${res.summary.shots} ช็อต\n${lines.join('\n')}` +
        (res.skipped_checks.length ? `\nเช็กที่ข้าม (ไม่ได้ติดตั้ง/ไม่เกี่ยว): ${res.skipped_checks.join(', ')}` : '') +
        (res.errors.length ? `\nปัญหา: ${res.errors.join('; ')}` : '') +
        (res.regen?.length ? `\nเจนซ่อม: ${res.regen.map((g) => `${g.shot_id}→${g.job_id ?? `ข้าม (${g.skipped_reason})`}`).join(', ')}` : '') +
        (res.summary.fail ? '\nใช้ get_keyframes ดูภาพช็อตที่พัง แล้ว review_shot / regen_shot' : '\nทุกช็อตผ่าน → ขอผู้ใช้อนุมัติ G3');
      return ok({ summary: res.summary, results: res.results, skipped_checks: res.skipped_checks, errors: res.errors, regen: res.regen ?? [] }, text);
    }),
  );

  server.registerTool(
    'get_keyframes',
    {
      title: 'ดูเฟรมของช็อต',
      description: 'Extract keyframes (default 3: at 10%, 50%, 90%) of the latest clip of a shot and return them as images so Claude can review the shot visually. Record the verdict with review_shot.',
      inputSchema: z.object({ series_id: Slug, episode: EpisodeNumber, shot_id: Slug, count: z.int().min(1).max(6).optional() }),
      annotations: { readOnlyHint: true },
    },
    guarded(ctx.log, 'get_keyframes', async ({ series_id, episode, shot_id, count }): Promise<CallToolResult> => {
      const res = await svc.keyframes(series_id, episode, shot_id, count);
      const qc = svc.loadResult(series_id, episode, shot_id);
      const header = `ช็อต ${shot_id} (คลิป ${res.clip}, v${res.version})${qc ? ` — QC อัตโนมัติ: ${qc.pass ? 'ผ่าน' : `ไม่ผ่าน: ${qc.reasons.join('; ')}`}` : ''}\nดูแล้วบันทึกผลด้วย review_shot (pass/fail + เหตุผล)`;
      return {
        content: [
          { type: 'text', text: header },
          ...res.files.map((f) => ({ type: 'image' as const, data: readFileSync(f).toString('base64'), mimeType: 'image/jpeg' })),
        ],
        structuredContent: { shot_id, clip: res.clip, version: res.version, frames: res.files.map((f) => ctx.store.rel(series_id, f)), qc: qc ?? null },
      };
    }),
  );

  server.registerTool(
    'review_shot',
    {
      title: 'บันทึกผลรีวิวสายตา',
      description: 'Record the visual verdict for a shot (by Claude after get_keyframes, or by a human). A passing review overrides a failed automatic QC for gate G3.',
      inputSchema: z.object({ series_id: Slug, episode: EpisodeNumber, shot_id: Slug, pass: z.boolean(), reason: z.string().min(1), by: z.enum(['claude', 'human']).default('claude') }),
    },
    guarded(ctx.log, 'review_shot', ({ series_id, episode, shot_id, pass, reason, by }) => {
      const r = svc.review(series_id, episode, shot_id, { pass, reason, by });
      return ok({ result: r }, `บันทึกรีวิว ${shot_id}: ${pass ? 'ผ่าน' : 'ไม่ผ่าน'} (${reason}) โดย ${by}`);
    }),
  );

  server.registerTool(
    'regen_shot',
    {
      title: 'เจนซ่อมช็อต',
      description:
        'Regenerate the batch that contains a shot: same deterministic prompt plus a [FIX] block with your notes (e.g. what QC or the visual review found). ' +
        'Bounded by qc.max_regen_attempts per batch; beyond that a human must decide. Manual engine: export_prompt_sheet again and import_clips the new take.',
      inputSchema: z.object({ series_id: Slug, episode: EpisodeNumber, shot_id: Slug, fix_notes: z.string().min(1) }),
    },
    guarded(ctx.log, 'regen_shot', async ({ series_id, episode, shot_id, fix_notes }) => {
      const res = await svc.regenShot(series_id, episode, shot_id, fix_notes);
      return ok(
        { job_id: res.job.id, batch_id: res.batch_id, attempt: res.job.attempt, shot_ids: res.shot_ids, status: res.job.status },
        `สร้างงานเจนซ่อม ${res.job.id} สำหรับ ${res.batch_id} (ครั้งที่ ${res.job.attempt}, ช็อต ${res.shot_ids.join(', ')}) สถานะ ${res.job.status}\n[FIX] ${fix_notes}` +
          (res.job.engine_id === 'manual' ? '\nโหมด manual: export_prompt_sheet แล้วเจนใน Flow จากนั้น import_clips (ตั้งชื่อไฟล์ให้มี batch id)' : ''),
      );
    }),
  );
}
