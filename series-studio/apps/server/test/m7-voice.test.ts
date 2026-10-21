import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { studioClient } from './mcpClient.js';
import { makeClip } from './clips.js';
import { probeDuration } from '../src/util/ffmpeg.js';
import { CartesiaVoiceAdapter } from '../src/voice/cartesia.js';
import { bible as fixtureBible, outline as fixtureOutline, script as fixtureScript, shots as fixtureShots } from '../../../packages/core/test/fixtures.js';

/** Non-silent regions (start,end) of an audio file via silencedetect. */
function loudRegions(file: string, total: number): Array<[number, number]> {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'silencedetect=n=-45dB:d=0.2', '-f', 'null', '-'], { encoding: 'utf8' });
  const starts = [...r.stderr.matchAll(/silence_start: ([0-9.]+)/g)].map((m) => Number(m[1]));
  const ends = [...r.stderr.matchAll(/silence_end: ([0-9.]+)/g)].map((m) => Number(m[1]));
  // silences -> complement
  const out: Array<[number, number]> = [];
  let cursor = 0;
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i]!;
    const e = ends[i] ?? total;
    if (s - cursor > 0.05) out.push([cursor, s]);
    cursor = e;
  }
  if (total - cursor > 0.05) out.push([cursor, total]);
  return out;
}

describe('M7: dub / narration voice track', () => {
  let s: Awaited<ReturnType<typeof studioClient>>;
  const SID = 'cafe-secret';
  const file = (...p: string[]) => join(s.t.ctx.store.seriesDir(SID), ...p);
  const strip = <T extends { refs?: unknown; locked?: unknown; ref_version?: unknown; flow_character_id?: unknown }>(e: T) => {
    const { refs: _r, locked: _l, ref_version: _v, flow_character_id: _f, ...rest } = e;
    return rest;
  };

  beforeAll(async () => {
    s = await studioClient({ assembly: { x264_preset: 'ultrafast', crf: 32 } });
    expect((await s.call('create_series', { id: SID, title: 'Cafe Secret', logline: 'x', style_id: 'live_kdrama_dub', aspect: '9:16', episodes: 1, ep_length_sec: 20 })).isError).toBe(false);
    expect((await s.call('write_bible', { series_id: SID, story_md: '# story', characters: fixtureBible.characters.map(strip), locations: fixtureBible.locations.map(strip), props: fixtureBible.props.map(strip) })).isError).toBe(false);
    expect((await s.call('write_outline', { series_id: SID, ...fixtureOutline })).isError).toBe(false);
    expect((await s.call('approve_gate', { series_id: SID, gate: 'G1' })).isError).toBe(false);
    const png = join(s.t.root, 'ref.png');
    writeFileSync(png, 'png');
    for (const [type, id] of [['character', 'mina'], ['character', 'tan'], ['location', 'cafe'], ['prop', 'letter']] as const) {
      await s.call('import_refs', { series_id: SID, entity_type: type, entity_id: id, files: [png] });
      await s.call('lock_asset', { series_id: SID, entity_type: type, entity_id: id });
    }
    expect((await s.call('approve_gate', { series_id: SID, gate: 'G2' })).isError).toBe(false);
    expect((await s.call('write_script', { series_id: SID, ...fixtureScript })).isError).toBe(false);
    expect((await s.call('write_shots', { series_id: SID, ...fixtureShots })).isError).toBe(false);
    expect((await s.call('compile_prompts', { series_id: SID, episode: 1 })).isError).toBe(false);
    expect((await s.call('generate', { series_id: SID, episode: 1, quality: 'draft' })).isError).toBe(false);
    const dl = join(s.t.root, 'dl');
    mkdirSync(dl);
    makeClip(join(dl, 'b01.mp4'), [['a', 3], ['b', 4]], true);
    makeClip(join(dl, 'b02.mp4'), [['a', 3.5], ['b', 3]], true);
    makeClip(join(dl, 'b03.mp4'), [['a', 3.5], ['b', 3]], true);
    expect((await s.call('import_clips', { series_id: SID, episode: 1, folder: dl })).isError).toBe(false);
  }, 180_000);
  afterAll(async () => {
    await s.close();
  });

  it('list_voices (mock) and assign_voice write voices.json', async () => {
    const lv = await s.call<{ voices: Array<{ id: string }> }>('list_voices', { provider: 'mock' });
    expect(lv.data.voices.map((v) => v.id)).toContain('mock_female_1');
    const missing = await s.call('dub_episode', { series_id: SID, episode: 1 });
    expect(missing.isError).toBe(true);
    expect(missing.text).toContain('ยังไม่มีเสียง');
    expect((await s.call('assign_voice', { series_id: SID, character_id: 'mina', voice_id: 'mock_female_1', provider: 'mock' })).isError).toBe(false);
    expect((await s.call('assign_voice', { series_id: SID, character_id: 'tan', voice_id: 'mock_male_1', provider: 'mock' })).isError).toBe(false);
    expect((await s.call('assign_voice', { series_id: SID, character_id: 'ghost', voice_id: 'x' })).isError).toBe(true);
    const voices = JSON.parse(readFileSync(file('bible/voices.json'), 'utf8'));
    expect(voices.mina.voice_id).toBe('mock_female_1');
  });

  it('dub_episode builds a content-length voice track with cues at the planned times, same voice per character', async () => {
    const r = await s.call<{ track: string; content_sec: number; cues: Array<{ speaker: string; voice_id: string; start_sec: number; file: string; speed: number; fits: boolean }>; warnings: string[] }>('dub_episode', { series_id: SID, episode: 1, provider: 'mock' });
    expect(r.isError, r.text).toBe(false);
    expect(r.data.track).toBe('episodes/ep01/edit/dub/voice_track.wav');
    expect(r.data.content_sec).toBe(20);
    expect(r.data.cues.map((c) => [c.speaker, c.voice_id, c.start_sec])).toEqual([['mina', 'mock_female_1', 7.6], ['tan', 'mock_male_1', 14.3]]);
    expect(r.data.cues.every((c) => c.fits && c.speed === 1)).toBe(true);
    const track = file(r.data.track);
    expect(Math.abs((await probeDuration('ffprobe', track)) - 20)).toBeLessThan(0.1);
    const regions = loudRegions(track, 20);
    expect(regions.length).toBe(2);
    expect(Math.abs(regions[0]![0] - 7.6)).toBeLessThanOrEqual(0.25);
    expect(Math.abs(regions[1]![0] - 14.3)).toBeLessThanOrEqual(0.25);
    expect(existsSync(file('episodes/ep01/edit/dub/dub.json'))).toBe(true);
    expect(existsSync(file(r.data.cues[0]!.file))).toBe(true);

    // second run reuses the cache
    const again = await s.call<{ cues: unknown[] }>('dub_episode', { series_id: SID, episode: 1, provider: 'mock' });
    expect(again.text).toContain('ใช้แคช 2');
  }, 120_000);

  it('cues too long for their slot are sped up (bounded) and reported', async () => {
    // shorten mina's window to 0.5s -> a 1.5s mock line cannot fit even at max speed-up
    const shots = JSON.parse(readFileSync(file('episodes/ep01/shots.json'), 'utf8'));
    for (const sh of shots.shots) for (const d of sh.dialogue) if (d.char === 'mina') { d.t_start = 0.6; d.t_end = 1.1; }
    s.t.ctx.store.writeJson(file('episodes/ep01/shots.json'), shots);
    const r = await s.call<{ cues: Array<{ speaker: string; speed: number; fits: boolean }>; warnings: string[] }>('dub_episode', { series_id: SID, episode: 1, provider: 'mock' });
    expect(r.isError, r.text).toBe(false);
    const mina = r.data.cues.find((c) => c.speaker === 'mina')!;
    expect(mina.speed).toBe(1.25); // config voice.max_speedup
    expect(mina.fits).toBe(false);
    expect(r.data.warnings.join(' ')).toContain('ล้น');
  }, 120_000);

  it('assemble uses the dub track automatically for a dub preset', async () => {
    const r = await s.call<{ timeline: { audio: { source: string; voice_track?: string } } }>('assemble', { series_id: SID, episode: 1, quality: 'draft' });
    expect(r.isError, r.text).toBe(false);
    expect(r.data.timeline.audio.source).toBe('voice_track');
    expect(r.data.timeline.audio.voice_track).toBe('episodes/ep01/edit/dub/voice_track.wav');
  }, 180_000);

  it('narration preset requires a NARRATOR voice and reads every line with it', async () => {
    const NID = 'ink-tale';
    expect((await s.call('create_series', { id: NID, title: 'Ink Tale', logline: 'x', style_id: 'ink_stick', aspect: '9:16', episodes: 1, ep_length_sec: 20 })).isError).toBe(false);
    expect((await s.call('write_bible', { series_id: NID, story_md: '# story', characters: fixtureBible.characters.map(strip), locations: fixtureBible.locations.map(strip), props: fixtureBible.props.map(strip) })).isError).toBe(false);
    expect((await s.call('write_outline', { series_id: NID, ...fixtureOutline })).isError).toBe(false);
    await s.call('approve_gate', { series_id: NID, gate: 'G1' });
    const png = join(s.t.root, 'ref2.png');
    writeFileSync(png, 'png');
    for (const [type, id] of [['character', 'mina'], ['character', 'tan'], ['location', 'cafe'], ['prop', 'letter']] as const) {
      await s.call('import_refs', { series_id: NID, entity_type: type, entity_id: id, files: [png] });
      await s.call('lock_asset', { series_id: NID, entity_type: type, entity_id: id });
    }
    expect((await s.call('approve_gate', { series_id: NID, gate: 'G2' })).isError).toBe(false);
    await s.call('write_script', { series_id: NID, ...fixtureScript });
    await s.call('write_shots', { series_id: NID, ...fixtureShots });
    expect((await s.call('compile_prompts', { series_id: NID, episode: 1 })).isError).toBe(false);
    const missing = await s.call('dub_episode', { series_id: NID, episode: 1, provider: 'mock' });
    expect(missing.isError).toBe(true);
    expect(missing.text).toContain('ผู้บรรยาย');
    await s.call('assign_voice', { series_id: NID, character_id: 'NARRATOR', voice_id: 'mock_narrator', provider: 'mock' });
    const r = await s.call<{ cues: Array<{ speaker: string; voice_id: string }> }>('dub_episode', { series_id: NID, episode: 1, provider: 'mock' });
    expect(r.isError, r.text).toBe(false);
    expect(r.data.cues.every((c) => c.speaker === 'NARRATOR' && c.voice_id === 'mock_narrator')).toBe(true);
  }, 120_000);
});

/** Live Cartesia check: runs only when the API answers (key in CARTESIA_API_KEY or an authenticating proxy). */
async function cartesiaReachable(): Promise<boolean> {
  try {
    const res = await fetch('https://api.cartesia.ai/voices?limit=1', { headers: { 'Cartesia-Version': '2025-04-16', ...(process.env['CARTESIA_API_KEY'] ? { 'X-API-Key': process.env['CARTESIA_API_KEY'] } : {}) }, signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    return false;
  }
}
const live = await cartesiaReachable();

describe.skipIf(!live)('Cartesia adapter (live)', () => {
  it('lists Thai voices and synthesizes a short Thai line', async () => {
    const adapter = new CartesiaVoiceAdapter({ api_url: 'https://api.cartesia.ai', version: '2025-04-16', model: 'sonic-3', sample_rate: 44100 }, 'ffprobe');
    const voices = await adapter.listVoices('th');
    expect(voices.length).toBeGreaterThan(0);
    const t = await import('node:os');
    const dest = join(t.tmpdir(), `series-studio-tts-${Date.now()}.wav`);
    const r = await adapter.synthesize({ text: 'สวัสดีค่ะ', voice_id: voices[0]!.id, lang: 'th', dest });
    expect(r.duration_sec).toBeGreaterThan(0.3);
  }, 60_000);
});
