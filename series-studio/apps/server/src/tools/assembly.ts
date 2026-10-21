import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Aspect, EpisodeNumber, Quality, Slug } from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { AssemblyService } from '../services/assembly.js';
import { guarded } from './_helpers.js';
import { runAsTask } from './_tasks.js';
import { renderers } from './_renderers.js';

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
        wait_sec: z.int().min(0).max(55).default(25).describe('Seconds to wait for completion before returning a task_id (encoding a 1080p episode often takes minutes)'),
      }),
    },
    guarded(ctx.log, 'assemble', async ({ series_id, episode, wait_sec, ...opts }) => {
      return runAsTask(
        ctx,
        { kind: 'assemble', label: `ประกอบตอนที่ ${episode} (${opts.quality})`, series_id, episode },
        wait_sec,
        async () => ({ ...(await svc.assemble(series_id, episode, opts)), episode, quality: opts.quality }),
        renderers['assemble']!,
      );
    }),
  );
}
