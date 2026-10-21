import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { EpisodeNumber, Quality, Script, ShotList, Slug } from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { EpisodeService } from '../services/episode.js';
import { fail, guarded, ok } from './_helpers.js';
import { reportText } from './_report.js';

export function registerEpisodeTools(server: McpServer, ctx: StudioContext): void {
  const svc = new EpisodeService(ctx);

  server.registerTool(
    'write_script',
    {
      title: 'เขียนบทตอน',
      description:
        'Write the episode script (script.json): scene headers + spoken Thai lines in each character\'s register (see character.speech). ' +
        'Returns timing estimates from Thai syllable counts (~5.5 syllables/sec) and warnings when speech will not fit the episode length.',
      inputSchema: Script.extend({ series_id: Slug }),
    },
    guarded(ctx.log, 'write_script', ({ series_id, ...script }) => {
      const res = svc.writeScript(series_id, Script.parse(script));
      if (!res.report.ok) return fail(`write_script ตอนที่ ${script.episode} ไม่ได้บันทึก:\n${reportText(res.report)}`, { report: res.report });
      return ok(
        { report: res.report, timing: res.timing },
        `บันทึกบทตอนที่ ${script.episode} แล้ว (${script.lines.length} บรรทัด, ≈${res.timing.syllables} พยางค์ ≈ ${res.timing.est_speech_sec} วิ จาก ${res.timing.ep_length_sec} วิ)\n${reportText(res.report)}\nขั้นต่อไป: write_shots`,
      );
    }),
  );

  server.registerTool(
    'write_shots',
    {
      title: 'เขียน shot list',
      description:
        'Write the shot list (shots.json). Validated by code: every shot has a purpose, first=hook, last=cliffhanger, 180° axis changes need a neutral INSERT or axis_cross_reason, ' +
        'characters/locations exist in the bible, wardrobe matches continuity on first appearance, dialogue fits inside the shot without overlap, each shot ≤ engine maxClipSec, total within ±tolerance of ep_length_sec. ' +
        'Nothing is written on errors. Returns the batch plan preview.',
      inputSchema: ShotList.extend({ series_id: Slug }),
    },
    guarded(ctx.log, 'write_shots', ({ series_id, ...list }) => {
      const res = svc.writeShots(series_id, ShotList.parse(list));
      if (!res.report.ok) return fail(`write_shots ตอนที่ ${list.episode} ไม่ได้บันทึก:\n${reportText(res.report)}`, { report: res.report });
      const total = list.shots.reduce((s, x) => s + x.duration_sec, 0);
      return ok(
        { report: res.report, batches_preview: res.batches_preview, total_sec: Math.round(total * 10) / 10 },
        `บันทึก shot list ตอนที่ ${list.episode} แล้ว (${list.shots.length} ช็อต รวม ${total.toFixed(1)} วิ → ${res.batches_preview.length} batch)\n${reportText(res.report)}\nขั้นต่อไป: compile_prompts (ต้องผ่าน G2 แล้ว)`,
      );
    }),
  );

  server.registerTool(
    'compile_prompts',
    {
      title: 'คอมไพล์ prompt',
      description:
        'Group shots into batches by engine maxClipSec and compile one deterministic prompt per batch (template + preset + bible + shot; no LLM). ' +
        'Writes batches/*.json and assigns shot.batch. Requires G2 approved.',
      inputSchema: z.object({ series_id: Slug, episode: EpisodeNumber, fix_notes: z.string().optional().describe('Appended as a [FIX] block to every batch (normally use regen_shot instead)') }),
    },
    guarded(ctx.log, 'compile_prompts', ({ series_id, episode, fix_notes }) => {
      const batches = svc.compilePrompts(series_id, episode, { fix_notes });
      const lines = batches.map((b) => `- ${b.id}: ${b.shot_ids.join(', ')} (${b.total_sec}s, refs ${b.ref_images.length})`);
      return ok(
        { batches: batches.map((b) => ({ id: b.id, shot_ids: b.shot_ids, total_sec: b.total_sec, ref_images: b.ref_images, prompt: b.prompt })) },
        `คอมไพล์ ${batches.length} batch ของตอนที่ ${episode} แล้ว:\n${lines.join('\n')}\nขั้นต่อไป: generate (สร้างงาน) แล้ว export_prompt_sheet สำหรับโหมด manual`,
      );
    }),
  );

  server.registerTool(
    'export_prompt_sheet',
    {
      title: 'ส่งออก prompt sheet',
      description: 'Write edit/prompt_sheet_<quality>.md and .csv for generating clips by hand in Flow (manual engine). Returns the markdown.',
      inputSchema: z.object({ series_id: Slug, episode: EpisodeNumber, quality: Quality.default('draft') }),
    },
    guarded(ctx.log, 'export_prompt_sheet', ({ series_id, episode, quality }) => {
      const res = svc.exportPromptSheet(series_id, episode, quality);
      return ok({ files: res.files, csv: res.csv }, res.md);
    }),
  );

  server.registerTool(
    'generate',
    {
      title: 'สั่งเจน',
      description:
        'Queue generation jobs for batches of an episode (default: all). quality draft first (480p / cheapest), final after G3. ' +
        'Manual engine: jobs wait for import_clips. Credits are recorded in cost.json.',
      inputSchema: z.object({ series_id: Slug, episode: EpisodeNumber, batch_ids: z.array(Slug).optional(), quality: Quality.default('draft'), fix_notes: z.string().optional() }),
    },
    guarded(ctx.log, 'generate', async ({ series_id, episode, batch_ids, quality, fix_notes }) => {
      const jobs = await svc.generate(series_id, episode, { batch_ids, quality, fix_notes });
      const manual = jobs.every((j) => j.engine_id === 'manual');
      return ok(
        { job_ids: jobs.map((j) => j.id), jobs: jobs.map((j) => ({ id: j.id, batch_id: j.batch_id, status: j.status, attempt: j.attempt, quality: j.quality })) },
        `สร้างงาน ${jobs.length} งาน (${quality}) สำหรับตอนที่ ${episode}:\n${jobs.map((j) => `- ${j.id} → ${j.batch_id} (ครั้งที่ ${j.attempt}) ${j.status}`).join('\n')}` +
          (manual ? '\nโหมด manual: ใช้ export_prompt_sheet เอา prompt ไปเจนใน Flow แล้ว import_clips' : ''),
      );
    }),
  );

  server.registerTool(
    'job_status',
    {
      title: 'สถานะงาน',
      description: 'Status of generation jobs by id, or all jobs of an episode/series.',
      inputSchema: z.object({ job_ids: z.array(z.string().min(1)).optional(), series_id: Slug.optional(), episode: EpisodeNumber.optional() }),
      annotations: { readOnlyHint: true },
    },
    guarded(ctx.log, 'job_status', ({ job_ids, series_id, episode }) => {
      let jobs;
      if (job_ids?.length) jobs = job_ids.map((id) => ctx.jobs.get(id)).filter((j) => j !== undefined);
      else if (series_id) jobs = ctx.jobs.list(episode === undefined ? { series_id } : { series_id, episode });
      else return fail('ระบุ job_ids หรือ series_id');
      const rows = jobs.map((j) => ({ id: j.id, kind: j.kind, episode: j.episode ?? null, batch_id: j.batch_id ?? null, entity_id: j.entity_id ?? null, status: j.status, attempt: j.attempt, quality: j.quality, output: j.output ?? null, cost_credits: j.cost_credits, error: j.error ?? null }));
      return ok({ jobs: rows }, rows.length ? rows.map((r) => `- ${r.id} [${r.kind}] ${r.batch_id ?? r.entity_id ?? ''} ครั้งที่ ${r.attempt}: ${r.status}${r.output ? ` → ${r.output}` : ''}${r.error ? ` (${r.error})` : ''}`).join('\n') : 'ไม่พบงาน');
    }),
  );

  server.registerTool(
    'import_clips',
    {
      title: 'นำเข้าคลิป',
      description:
        'Import generated clips (folder and/or files) for an episode and map them to batches/shots. Matching: job id or batch id (b01) or a shot id in the file name; otherwise by order. ' +
        'Files are copied to gen/<batch>/v<attempt>.mp4 and per-shot pointers gen/<shot>/v<attempt>.json are written.',
      inputSchema: z.object({ series_id: Slug, episode: EpisodeNumber, folder: z.string().min(1).optional(), files: z.array(z.string().min(1)).optional() }),
    },
    guarded(ctx.log, 'import_clips', ({ series_id, episode, folder, files }) => {
      const res = svc.importClips(series_id, episode, { folder, files });
      const text =
        `นำเข้า ${res.mapped.length} คลิปของตอนที่ ${episode}:\n${res.mapped.map((m) => `- ${m.file.split(/[\\/]/).pop()} → ${m.batch_id} (${m.shot_ids.join(', ')}) [${m.how}]`).join('\n')}` +
        (res.unmatched.length ? `\nจับคู่ไม่ได้: ${res.unmatched.map((f) => f.split(/[\\/]/).pop()).join(', ')}` : '') +
        (res.warnings.length ? `\nคำเตือน:\n- ${res.warnings.join('\n- ')}` : '') +
        (res.mapped.length ? '\nขั้นต่อไป: run_qc' : '');
      return ok({ mapped: res.mapped, unmatched: res.unmatched, warnings: res.warnings }, text);
    }),
  );
}
