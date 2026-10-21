import type { VoiceAdapter } from '@series-studio/core';
import type { StudioContext } from '../context.js';
import { MockVoiceAdapter } from './mock.js';
import { CartesiaVoiceAdapter } from './cartesia.js';

export function getVoiceAdapter(ctx: StudioContext, provider?: string): VoiceAdapter {
  const id = provider ?? ctx.config.voice.provider;
  switch (id) {
    case 'mock':
      return new MockVoiceAdapter(ctx.config.tools.ffmpeg, ctx.config.tools.ffprobe, ctx.config.script.syllables_per_sec);
    case 'cartesia':
      return new CartesiaVoiceAdapter(ctx.config.voice.cartesia, ctx.config.tools.ffprobe);
    default:
      throw new Error(`ไม่รู้จัก voice provider "${id}" (รองรับ: mock, cartesia)`);
  }
}
