import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { EpisodeNumber, Slug, Voices } from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { SeriesService } from '../services/series.js';
import { VoiceService } from '../services/voice.js';
import { getVoiceAdapter } from '../voice/index.js';
import { fail, guarded, ok } from './_helpers.js';
import { reportText } from './_report.js';
import { runAsTask } from './_tasks.js';
import { renderers } from './_renderers.js';

export function registerVoiceTools(server: McpServer, ctx: StudioContext): void {
  const series = new SeriesService(ctx);
  const voice = new VoiceService(ctx);

  server.registerTool(
    'list_voices',
    {
      title: 'รายการเสียง',
      description: 'List voices of a TTS provider (default: config voice.provider; "mock" works offline, "cartesia" needs CARTESIA_API_KEY). Filter by language code (default th).',
      inputSchema: z.object({ provider: z.string().min(1).optional(), lang: z.string().max(8).default('th').describe('Language code, or "all" for every language') }),
      annotations: { readOnlyHint: true },
    },
    guarded(ctx.log, 'list_voices', async ({ provider, lang }) => {
      const adapter = getVoiceAdapter(ctx, provider);
      const langFilter = lang === 'all' || lang === '' ? '' : lang;
      const voices = await adapter.listVoices(langFilter);
      return ok({ provider: adapter.id, voices }, voices.length ? `เสียง (${adapter.id}, ${langFilter || 'ทุกภาษา'}) ${voices.length} เสียง:\n${voices.map((v) => `- ${v.id}: ${v.name}${v.gender ? ` (${v.gender})` : ''}`).join('\n')}` : `ไม่พบเสียงภาษา ${langFilter || 'ใดๆ'} ใน ${adapter.id}`);
    }),
  );

  server.registerTool(
    'assign_voice',
    {
      title: 'กำหนดเสียงตัวละคร',
      description: 'Assign a voice to a character (or NARRATOR) in bible/voices.json. One voice per character for the whole series keeps every clip consistent.',
      inputSchema: z.object({ series_id: Slug, character_id: z.string().min(1), voice_id: z.string().min(1), provider: z.string().min(1).optional(), lang: z.string().min(2).max(8).default('th'), notes: z.string().optional() }),
    },
    guarded(ctx.log, 'assign_voice', ({ series_id, character_id, voice_id, provider, lang, notes }) => {
      series.load(series_id);
      if (character_id !== 'NARRATOR' && !series.loadEntityIfExists(series_id, 'character', character_id)) return fail(`ไม่พบตัวละคร "${character_id}" ในซีรีส์ ${series_id}`);
      const voices = series.loadVoices(series_id);
      voices[character_id] = Voices.parse({ [character_id]: { voice_id, lang, ...(provider ? { provider } : {}), ...(notes ? { notes } : {}) } })[character_id]!;
      ctx.store.writeJson(ctx.store.biblePath(series_id, 'voices.json'), voices);
      ctx.emit({ type: 'bible', series_id });
      return ok({ voices }, `กำหนดเสียง ${character_id} → ${voice_id}${provider ? ` (${provider})` : ''} แล้ว`);
    }),
  );

  server.registerTool(
    'dub_episode',
    {
      title: 'ทำเสียงพากย์/บรรยายทั้งตอน',
      description:
        'Synthesize every dialogue cue of an episode with each character\'s assigned voice (narration mode: the NARRATOR voice reads all lines), fit cues to their time slots (bounded speed-up), ' +
        'and build edit/dub/voice_track.wav aligned to the first clip. `assemble` then uses the track automatically for dub/narration presets. Cached per (voice, text, speed); force=true re-synthesizes.',
      inputSchema: z.object({ series_id: Slug, episode: EpisodeNumber, provider: z.string().min(1).optional(), force: z.boolean().optional(), wait_sec: z.int().min(0).max(55).default(40) }),
    },
    guarded(ctx.log, 'dub_episode', async ({ series_id, episode, provider, force, wait_sec }) => {
      // plan first (fast) so missing voices come back as a normal error, then synthesize in the background
      const plan = voice.plan(series_id, episode);
      if (!plan.report.ok) return fail(`dub_episode ตอนที่ ${episode} ทำไม่ได้:\n${reportText(plan.report)}`, { report: plan.report });
      return runAsTask(
        ctx,
        { kind: 'dub_episode', label: `พากย์ตอนที่ ${episode}`, series_id, episode },
        wait_sec,
        async () => ({ ...(await voice.dub(series_id, episode, { provider, force })), episode }),
        renderers['dub_episode']!,
      );
    }),
  );
}
