/** Voice synthesis adapter (SPEC §8.8 dub/narration, M7). TTS today; voice-change later. */
export interface VoiceInfo {
  id: string;
  name: string;
  lang?: string | undefined;
  gender?: string | undefined;
  provider: string;
}

export interface SynthesizeRequest {
  text: string;
  voice_id: string;
  lang: string;
  /** 0.5–2.0, 1 = normal. Adapters that cannot change speed ignore it. */
  speed?: number | undefined;
  /** Destination file (wav). */
  dest: string;
}

export interface SynthesizeResult {
  file: string;
  duration_sec: number;
}

export interface VoiceAdapter {
  readonly id: string;
  listVoices(lang?: string): Promise<VoiceInfo[]>;
  synthesize(req: SynthesizeRequest): Promise<SynthesizeResult>;
}
