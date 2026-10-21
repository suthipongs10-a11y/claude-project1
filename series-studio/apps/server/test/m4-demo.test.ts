import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Timeline } from '@series-studio/core';
import { studioClient } from './mcpClient.js';
import { makeClip } from './clips.js';
import { integratedLoudness, probeDuration } from '../src/util/ffmpeg.js';
import { assStyle, parseSrt, toSrt } from '../src/util/subtitles.js';
import { bible as fixtureBible, outline as fixtureOutline, script as fixtureScript, shots as fixtureShots } from '../../../packages/core/test/fixtures.js';

/**
 * M4 acceptance: one finished episode file with even loudness (-14 LUFS) and subtitles on time (±0.2s).
 * Timeline: title card 2s | b01 7s | b02 6.5s | b03 6.5s | end card 3s = 25s.
 */
describe('M4 demo: assembly, loudnorm, SRT, cards, export', () => {
  let s: Awaited<ReturnType<typeof studioClient>>;
  const SID = 'cafe-secret';
  const file = (...p: string[]) => join(s.t.ctx.store.seriesDir(SID), ...p);
  const strip = <T extends { refs?: unknown; locked?: unknown; ref_version?: unknown; flow_character_id?: unknown }>(e: T) => {
    const { refs: _r, locked: _l, ref_version: _v, flow_character_id: _f, ...rest } = e;
    return rest;
  };

  beforeAll(async () => {
    s = await studioClient({ assembly: { x264_preset: 'ultrafast', crf: 30 } });
    expect((await s.call('create_series', { id: SID, title: 'Cafe Secret', logline: 'x', style_id: 'live_kdrama_dub', aspect: '9:16', episodes: 2, ep_length_sec: 20 })).isError).toBe(false);
    expect((await s.call('write_bible', { series_id: SID, story_md: '# story', characters: fixtureBible.characters.map(strip), locations: fixtureBible.locations.map(strip), props: fixtureBible.props.map(strip) })).isError).toBe(false);
    expect((await s.call('write_outline', { series_id: SID, ...fixtureOutline })).isError).toBe(false);
    expect((await s.call('write_outline', { series_id: SID, ...fixtureOutline, episode: 2, title: 'จดหมายฉบับที่สอง' })).isError).toBe(false);
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
    makeClip(join(dl, 'b03.mp4'), [['a', 3.5], ['b', 3]], false); // silent clip -> padded with silence
    expect((await s.call('import_clips', { series_id: SID, episode: 1, folder: dl })).isError).toBe(false);
    const qc = await s.call('run_qc', { series_id: SID, episode: 1 });
    expect(qc.isError, qc.text).toBe(false);
  }, 180_000);
  afterAll(async () => {
    await s.close();
  });

  it('srt + ass helpers', () => {
    const srt = toSrt([{ index: 1, start_sec: 9.6, end_sec: 11.4, char: 'mina', text: 'คุณ...มาทำอะไรที่นี่', shot_id: 'ep01_s003' }]);
    expect(srt).toContain('00:00:09,600 --> 00:00:11,400');
    expect(parseSrt(srt)[0]).toMatchObject({ start_sec: 9.6, end_sec: 11.4, text: 'คุณ...มาทำอะไรที่นี่' });
    expect(assStyle('yellow_bold_bottom', 'Loma', '9:16')).toContain('PrimaryColour=&H0000FFFF');
    expect(assStyle('unknown_style', 'Loma', '16:9')).toContain('Alignment=2');
  });

  it('draft preview renders without G3, final needs G3', async () => {
    const fin = await s.call('assemble', { series_id: SID, episode: 1, quality: 'final' });
    expect(fin.isError).toBe(true);
    expect(fin.text).toContain('G3');
    const draft = await s.call<{ timeline: { width: number; height: number; total_sec: number; outputs: { video: string } }; warnings: string[] }>('assemble', { series_id: SID, episode: 1, quality: 'draft' });
    expect(draft.isError, draft.text).toBe(false);
    expect(draft.data.timeline.width).toBe(540);
    expect(draft.data.timeline.height).toBe(960);
    expect(draft.data.timeline.total_sec).toBe(25);
    expect(draft.data.timeline.outputs.video).toBe('episodes/ep01/edit/preview_ep01_9x16.mp4');
    expect(existsSync(file('episodes/ep01/edit/preview_ep01_9x16.mp4'))).toBe(true);
    expect(draft.data.warnings.join(' ')).toContain('b03: คลิปไม่มีเสียง');
  }, 180_000);

  it('final export: 1080x1920 H.264, loudness at target, subtitles on time, cover, timeline.json', async () => {
    expect((await s.call('approve_gate', { series_id: SID, gate: 'G3', episode: 1 })).isError).toBe(false);
    const r = await s.call<{ timeline: unknown; video: string; srt: string; cover: string }>('assemble', { series_id: SID, episode: 1, quality: 'final' });
    expect(r.isError, r.text).toBe(false);
    const tl = Timeline.parse(r.data.timeline);
    expect(tl.outputs.video).toBe('episodes/ep01/final/ep01_9x16.mp4');
    expect(tl.segments.map((x) => x.id)).toEqual(['title', 'b01', 'b02', 'b03', 'end']);
    expect(tl.segments[1]?.start_sec).toBe(2);
    const video = file('episodes/ep01/final/ep01_9x16.mp4');
    expect(existsSync(video)).toBe(true);
    const dur = await probeDuration('ffprobe', video);
    expect(Math.abs(dur - 25)).toBeLessThan(0.6);
    const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height', '-of', 'json', video], { encoding: 'utf8' });
    const st = JSON.parse(probe.stdout).streams[0];
    expect(st).toMatchObject({ codec_name: 'h264', width: 1080, height: 1920 });
    const lufs = await integratedLoudness('ffmpeg', video);
    expect(Math.abs(lufs - (-14))).toBeLessThan(1.5);

    // subtitles: s003 dialogue 0.6-2.4 inside b02 which starts at 2+7=9 -> 9.6-11.4 ; s005 0.8-1.8 inside b03 at 15.5 -> 16.3-17.3
    const srt = parseSrt(readFileSync(file('episodes/ep01/final/ep01.srt'), 'utf8'));
    expect(srt.length).toBe(2);
    expect(Math.abs(srt[0]!.start_sec - 9.6)).toBeLessThanOrEqual(0.2);
    expect(Math.abs(srt[0]!.end_sec - 11.4)).toBeLessThanOrEqual(0.2);
    expect(Math.abs(srt[1]!.start_sec - 16.3)).toBeLessThanOrEqual(0.2);
    expect(srt[0]!.text).toBe('คุณ...มาทำอะไรที่นี่');
    expect(existsSync(file('episodes/ep01/final/ep01_cover.jpg'))).toBe(true);
    expect(existsSync(file('episodes/ep01/edit/timeline_final.json'))).toBe(true);
    expect(JSON.parse(readFileSync(file('episodes/ep01/state.json'), 'utf8')).status).toBe('assembling');

    const g4 = await s.call<{ series_status: string }>('approve_gate', { series_id: SID, gate: 'G4', episode: 1 });
    expect(g4.isError, g4.text).toBe(false);
    expect(JSON.parse(readFileSync(file('episodes/ep01/state.json'), 'utf8')).status).toBe('final_ready');
  }, 300_000);

  it('16:9 export with music ducking and a voice track', async () => {
    const music = join(s.t.root, 'music.wav');
    spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=5', music]);
    const voice = join(s.t.root, 'voice.wav');
    spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=660:duration=20', voice]);
    const r = await s.call<{ timeline: { aspect: string; width: number; height: number; audio: { source: string } } }>('assemble', { series_id: SID, episode: 1, quality: 'final', aspect: '16:9', music, voice_track: voice });
    expect(r.isError, r.text).toBe(false);
    expect(r.data.timeline).toMatchObject({ aspect: '16:9', width: 1920, height: 1080, audio: { source: 'voice_track' } });
    const video = file('episodes/ep01/final/ep01_16x9.mp4');
    expect(existsSync(video)).toBe(true);
    const lufs = await integratedLoudness('ffmpeg', video);
    expect(Math.abs(lufs - (-14))).toBeLessThan(1.5);
  }, 300_000);
});
