import { countSyllables, type SynthesizeRequest, type SynthesizeResult, type VoiceAdapter, type VoiceInfo } from '@series-studio/core';
import { probeDuration, run } from '../util/ffmpeg.js';

/**
 * Offline adapter: a soft tone whose length follows the Thai syllable count. Useful for tests,
 * timing previews and machines without a TTS key. Different voices get different pitches so a
 * listener can tell speakers apart in a preview.
 */
export class MockVoiceAdapter implements VoiceAdapter {
  readonly id = 'mock';
  constructor(
    private readonly ffmpeg: string,
    private readonly ffprobe: string,
    private readonly syllablesPerSec: number,
  ) {}

  async listVoices(): Promise<VoiceInfo[]> {
    return [
      { id: 'mock_female_1', name: 'Mock หญิง 1', lang: 'th', gender: 'feminine', provider: 'mock' },
      { id: 'mock_male_1', name: 'Mock ชาย 1', lang: 'th', gender: 'masculine', provider: 'mock' },
      { id: 'mock_narrator', name: 'Mock ผู้บรรยาย', lang: 'th', provider: 'mock' },
    ];
  }

  async synthesize(req: SynthesizeRequest): Promise<SynthesizeResult> {
    const seconds = Math.max(0.3, countSyllables(req.text) / (this.syllablesPerSec * (req.speed ?? 1)));
    let hash = 0;
    for (const ch of req.voice_id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const freq = 180 + (hash % 220);
    const r = await run(this.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `sine=frequency=${freq}:duration=${seconds.toFixed(3)}`, '-af', 'volume=0.4', '-ar', '44100', '-ac', '1', req.dest]);
    if (r.code !== 0) throw new Error(`mock TTS ล้มเหลว: ${r.stderr.trim()}`);
    return { file: req.dest, duration_sec: await probeDuration(this.ffprobe, req.dest) };
  }
}
