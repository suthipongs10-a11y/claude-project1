import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Aspect, EpisodeNumber, Quality, Slug } from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { AssemblyService } from '../services/assembly.js';
import { guarded, ok } from './_helpers.js';

export function registerAssemblyTools(server: McpServer, ctx: StudioContext): void {
  const svc = new AssemblyService(ctx);

  server.registerTool(
    'assemble',
    {
      title: 'ประกอบตอน',
      description:
        'Assemble an episode with ffmpeg: concat batch clips on the planned timeline, title/end (and product) cards, AI label (and ad label in product mode), ' +
        'SRT from dialogue timing (burned per preset subtitle_style, plus a separate .srt), two-pass loudnorm to the configured LUFS, cover frame from the cliffhanger shot. ' +
        'quality "draft" renders a half-size preview into edit/ without needing G3; "final" needs G3 and writes final/epNN_9x16.mp4 (or 16x9). ' +
        'Options: music (ducked under speech), voice_track (dub/narration track replacing clip audio), aspect override.',
      inputSchema: z.object({
        series_id: Slug,
        episode: EpisodeNumber,
        quality: Quality.default('draft'),
        aspect: Aspect.optional(),
        music: z.string().min(1).optional(),
        voice_track: z.string().min(1).optional(),
        burn_subtitles: z.boolean().optional(),
        cards: z.boolean().optional(),
        ai_label: z.boolean().optional(),
      }),
    },
    guarded(ctx.log, 'assemble', async ({ series_id, episode, ...opts }) => {
      const res = await svc.assemble(series_id, episode, opts);
      const tl = res.timeline;
      const text =
        `ประกอบตอนที่ ${episode} (${opts.quality}, ${tl.aspect} ${tl.width}x${tl.height}, ${tl.total_sec}s, ${tl.subtitles.length} ซับ) แล้ว\n` +
        `- วิดีโอ: ${tl.outputs.video}\n` +
        (tl.outputs.srt ? `- ซับ: ${tl.outputs.srt}\n` : '') +
        (tl.outputs.cover ? `- ปก: ${tl.outputs.cover}\n` : '') +
        `- ความดังก่อนปรับ ${tl.audio.measured?.['input_i']?.toFixed(1)} LUFS → เป้า ${tl.audio.loudness_lufs} LUFS\n` +
        (res.warnings.length ? `คำเตือน:\n- ${res.warnings.join('\n- ')}\n` : '') +
        (opts.quality === 'final' ? 'ขั้นต่อไป: ให้ผู้ใช้ดูไฟล์แล้ว approve_gate G4' : 'ดูตัวอย่างแล้วถ้าโอเค approve_gate G3 → assemble quality final');
      return ok({ timeline: tl, video: res.video, srt: res.srt ?? null, cover: res.cover ?? null, warnings: res.warnings }, text);
    }),
  );
}
