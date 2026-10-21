import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Character, EntityType, Location, Prop, Slug, Voices } from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { BibleService } from '../services/bible.js';
import { ENTITY_LABEL } from '../services/series.js';
import { fail, guarded, ok } from './_helpers.js';
import { reportText } from './_report.js';

const managed = { refs: true, ref_version: true, locked: true, flow_character_id: true } as const;
const CharacterIn = Character.omit(managed);
const LocationIn = Location.omit({ refs: true, ref_version: true, locked: true });
const PropIn = Prop.omit({ refs: true, ref_version: true, locked: true });

export function registerBibleTools(server: McpServer, ctx: StudioContext): void {
  const svc = new BibleService(ctx, ctx.jobs);

  server.registerTool(
    'write_bible',
    {
      title: 'เขียน Series Bible',
      description:
        'Write/replace the series bible: story.md (logline, themes, season arc), characters, locations, props, voices. ' +
        'Validated by code (ids, cross-refs, forbidden real-world names). Locked assets keep their look; refs/locks are managed by other tools. ' +
        'Nothing is written when there are errors. Character `look` must be stable: it is pasted verbatim into every prompt.',
      inputSchema: z.object({
        series_id: Slug,
        story_md: z.string().min(1).describe('Markdown: logline, theme, season arc, episode-by-episode summary'),
        characters: z.array(CharacterIn).min(1),
        locations: z.array(LocationIn).min(1),
        props: z.array(PropIn).default([]),
        voices: Voices.optional().describe('character id (or NARRATOR) -> voice assignment'),
        extra_forbidden: z.array(z.string().min(1)).optional().describe('Extra forbidden terms for this series (e.g. real actor names)'),
      }),
    },
    guarded(ctx.log, 'write_bible', ({ series_id, ...input }) => {
      const res = svc.write(series_id, input);
      if (!res.report.ok) return fail(`write_bible ไม่ได้บันทึก เพราะพบข้อผิดพลาด:\n${reportText(res.report)}`, { report: res.report });
      return ok({ report: res.report, written: res.written, kept: res.kept }, `บันทึก bible แล้ว ${res.written.length} ไฟล์\n${reportText(res.report)}`);
    }),
  );

  server.registerTool(
    'gen_reference',
    {
      title: 'เจนภาพอ้างอิง',
      description:
        'Create deterministic reference-image prompts for a character/location/prop (character sheet views from the preset, empty location plates, prop packshots) ' +
        'and queue ref jobs. With the manual engine the prompts are returned for the user to generate in Flow, then import_refs.',
      inputSchema: z.object({
        series_id: Slug,
        entity_type: EntityType,
        entity_id: Slug,
        views: z.array(z.string().min(1)).optional().describe('Override views, e.g. ["front","3/4","expression: angry"]'),
      }),
    },
    guarded(ctx.log, 'gen_reference', ({ series_id, entity_type, entity_id, views }) => {
      const res = svc.genReference(series_id, entity_type, entity_id, views);
      return ok(
        { job_ids: res.jobs.map((j) => j.id), jobs: res.jobs.map((j) => ({ id: j.id, view: j.view, status: j.status, prompt: j.prompt })) },
        res.sheet,
      );
    }),
  );

  server.registerTool(
    'import_refs',
    {
      title: 'นำเข้าภาพอ้างอิง',
      description:
        'Attach generated reference images (png/jpg/webp paths on this machine) to an asset. Files are copied into bible/<kind>/<id>/refs/v<version>/. ' +
        'Pass job_id to mark a specific ref job done; otherwise pending ref jobs are completed in order.',
      inputSchema: z.object({
        series_id: Slug,
        entity_type: EntityType,
        entity_id: Slug,
        files: z.array(z.string().min(1)).min(1),
        job_id: z.string().min(1).optional(),
        replace: z.boolean().optional().describe('Replace the current ref list instead of appending'),
      }),
    },
    guarded(ctx.log, 'import_refs', ({ series_id, entity_type, entity_id, files, job_id, replace }) => {
      const res = svc.importRefs(series_id, entity_type, entity_id, files, { job_id, replace });
      const text =
        `เพิ่มภาพอ้างอิงให้${ENTITY_LABEL[entity_type]} "${entity_id}" แล้ว ${res.added.length} ไฟล์ (รวม ${res.entity.refs.length})` +
        (res.warnings.length ? `\nคำเตือน: ${res.warnings.join('; ')}` : '') +
        `\nถ้าภาพผ่านตาแล้วใช้ lock_asset`;
      return ok({ entity: res.entity, added: res.added, warnings: res.warnings }, text);
    }),
  );

  server.registerTool(
    'lock_asset',
    {
      title: 'ล็อก asset',
      description: 'Lock an asset after its reference images are approved. Locked refs can never be overwritten; appearance fields become read-only.',
      inputSchema: z.object({ series_id: Slug, entity_type: EntityType, entity_id: Slug }),
    },
    guarded(ctx.log, 'lock_asset', ({ series_id, entity_type, entity_id }) => {
      const e = svc.lock(series_id, entity_type, entity_id);
      return ok({ entity: e }, `lock ${ENTITY_LABEL[entity_type]} "${entity_id}" แล้ว (refs ${e.refs.length} ไฟล์, v${e.ref_version})`);
    }),
  );

  server.registerTool(
    'unlock_asset',
    {
      title: 'ปลดล็อก asset',
      description: 'Unlock an asset to change its look or refs. Opens a new reference version; old refs are kept on disk.',
      inputSchema: z.object({ series_id: Slug, entity_type: EntityType, entity_id: Slug }),
    },
    guarded(ctx.log, 'unlock_asset', ({ series_id, entity_type, entity_id }) => {
      const e = svc.unlock(series_id, entity_type, entity_id);
      return ok({ entity: e }, `unlock ${ENTITY_LABEL[entity_type]} "${entity_id}" แล้ว ref ใหม่จะเก็บเป็น v${e.ref_version} (ของเดิมยังอยู่)`);
    }),
  );
}
