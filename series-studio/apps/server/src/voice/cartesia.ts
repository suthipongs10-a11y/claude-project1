import { writeFileSync } from 'node:fs';
import type { SynthesizeRequest, SynthesizeResult, VoiceAdapter, VoiceInfo } from '@series-studio/core';
import { probeDuration } from '../util/ffmpeg.js';

export interface CartesiaConfig {
  api_url: string;
  version: string;
  model: string;
  sample_rate: number;
}

/**
 * Cartesia TTS (Thai supported). The key comes from the CARTESIA_API_KEY environment variable,
 * never from a file in the repo (CLAUDE.md rule 8 spirit). Requests fail with a Thai message when
 * the key is missing, unless an authenticating proxy is in front (then requests just work).
 */
export class CartesiaVoiceAdapter implements VoiceAdapter {
  readonly id = 'cartesia';
  constructor(
    private readonly cfg: CartesiaConfig,
    private readonly ffprobe: string,
    private readonly apiKey: string | undefined = process.env['CARTESIA_API_KEY'],
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private headers(json = true): Record<string, string> {
    const h: Record<string, string> = { 'Cartesia-Version': this.cfg.version };
    if (json) h['Content-Type'] = 'application/json';
    if (this.apiKey) h['X-API-Key'] = this.apiKey;
    return h;
  }

  async listVoices(lang = 'th'): Promise<VoiceInfo[]> {
    const out: VoiceInfo[] = [];
    let page: string | undefined;
    for (let i = 0; i < 10; i++) {
      const url = new URL('/voices', this.cfg.api_url);
      url.searchParams.set('limit', '100');
      if (page) url.searchParams.set('starting_after', page);
      const res = await this.fetchImpl(url, { headers: this.headers(false) });
      if (!res.ok) throw new Error(`Cartesia /voices ล้มเหลว (${res.status}): ${(await res.text()).slice(0, 200)}${res.status === 401 ? ' — ตั้ง CARTESIA_API_KEY' : ''}`);
      const body = (await res.json()) as { data?: Array<{ id: string; name: string; language?: string; gender?: string }>; has_more?: boolean; next_page?: string };
      for (const v of body.data ?? []) if (!lang || v.language === lang) out.push({ id: v.id, name: v.name, lang: v.language, gender: v.gender, provider: 'cartesia' });
      if (!body.has_more || !body.next_page) break;
      page = body.next_page;
    }
    return out;
  }

  async synthesize(req: SynthesizeRequest): Promise<SynthesizeResult> {
    const body: Record<string, unknown> = {
      model_id: this.cfg.model,
      transcript: req.text,
      voice: { mode: 'id', id: req.voice_id },
      output_format: { container: 'wav', encoding: 'pcm_s16le', sample_rate: this.cfg.sample_rate },
      language: req.lang,
    };
    if (req.speed && req.speed !== 1) body['generation_config'] = { speed: req.speed };
    const res = await this.fetchImpl(new URL('/tts/bytes', this.cfg.api_url), { method: 'POST', headers: this.headers(), body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Cartesia TTS ล้มเหลว (${res.status}): ${(await res.text()).slice(0, 300)}${res.status === 401 ? ' — ตั้ง CARTESIA_API_KEY' : ''}`);
    writeFileSync(req.dest, Buffer.from(await res.arrayBuffer()));
    return { file: req.dest, duration_sec: await probeDuration(this.ffprobe, req.dest) };
  }
}
