import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { studioClient } from './mcpClient.js';
import { makeClip } from './clips.js';
import { EpisodeService } from '../src/services/episode.js';
import { bible as fixtureBible, outline as fixtureOutline, script as fixtureScript, shots as fixtureShots } from '../../../packages/core/test/fixtures.js';

/**
 * M8 acceptance: a 10-episode product-mode season where wardrobe and injuries carry across episodes
 * without mistakes: the validator blocks every planted continuity error, prompts carry the state,
 * bridge/product rules hold, and cost_report shows the savings.
 */
describe('M8 demo: 10-episode season with product mode and continuity', () => {
  let s: Awaited<ReturnType<typeof studioClient>>;
  const SID = 'sunscreen-love';
  const file = (...p: string[]) => join(s.t.ctx.store.seriesDir(SID), ...p);
  const strip = <T extends { refs?: unknown; locked?: unknown; ref_version?: unknown; flow_character_id?: unknown }>(e: T) => {
    const { refs: _r, locked: _l, ref_version: _v, flow_character_id: _f, ...rest } = e;
    return rest;
  };
  const BRIDGE = [3, 7, 10];
  const epShots = (n: number, mod: (shot: (typeof fixtureShots.shots)[number], i: number) => (typeof fixtureShots.shots)[number] = (x) => x) => ({
    episode: n,
    shots: fixtureShots.shots.map((sh, i) => mod({ ...sh, id: sh.id.replace('ep01', `ep${String(n).padStart(2, '0')}`) }, i)),
  });
  const withBridge = (sh: (typeof fixtureShots.shots)[number], i: number) => (i === 4 ? { ...sh, beat: 'bridge' as const, props: ['cream'], action: 'tan sets the sunscreen tube on the counter between them' } : sh);
  const minaWears = (w: string) => (sh: (typeof fixtureShots.shots)[number]) => ({ ...sh, characters: sh.characters.map((c) => (c.id === 'mina' ? { ...c, wardrobe: w } : c)) });

  beforeAll(async () => {
    s = await studioClient({ assembly: { x264_preset: 'ultrafast', crf: 32 } });
    const r = await s.call('create_series', {
      id: SID, title: 'รักนี้มีครีมกันแดด', logline: 'x', style_id: 'live_kdrama_dub', aspect: '9:16', episodes: 10, ep_length_sec: 20, engine_id: 'flow_ext',
      product: { name: 'ครีมกันแดด X', prop_id: 'cream', selling_points: ['กันน้ำ', 'ไม่เหนียว', 'SPF50'], cta: 'สั่งซื้อที่ลิงก์ใต้คลิป', bridge_episodes: BRIDGE },
    });
    expect(r.isError, r.text).toBe(false);
    const wb = await s.call('write_bible', {
      series_id: SID, story_md: '# story', characters: fixtureBible.characters.map(strip), locations: fixtureBible.locations.map(strip),
      props: [...fixtureBible.props.map(strip), { id: 'cream', name: 'ครีมกันแดด X', look: 'white tube with a blue cap' }],
    });
    expect(wb.isError, wb.text).toBe(false);
    expect(JSON.parse(readFileSync(file('bible/props/cream.json'), 'utf8')).is_product).toBe(true); // auto-flagged from series.product
  }, 60_000);
  afterAll(async () => {
    await s.close();
  });

  it('outlines: bridge beats only in product episodes; G1 and G2 pass', async () => {
    const beats = fixtureOutline.beats;
    const bridgeBeats = [...beats.slice(0, 3), { id: 'bridge', type: 'bridge', summary: 'ครีมกันแดดโผล่' }, beats[3]];
    for (let n = 1; n <= 10; n++) {
      const isBridge = BRIDGE.includes(n);
      const wrong = await s.call('write_outline', { series_id: SID, ...fixtureOutline, episode: n, title: `ตอน ${n}`, beats: isBridge ? beats : bridgeBeats });
      expect(wrong.isError, `ep${n} wrong outline accepted`).toBe(true);
      const right = await s.call('write_outline', { series_id: SID, ...fixtureOutline, episode: n, title: `ตอน ${n}`, beats: isBridge ? bridgeBeats : beats });
      expect(right.isError, right.text).toBe(false);
    }
    expect((await s.call('approve_gate', { series_id: SID, gate: 'G1' })).isError).toBe(false);
    const png = join(s.t.root, 'ref.png');
    writeFileSync(png, 'png');
    for (const [type, id] of [['character', 'mina'], ['character', 'tan'], ['location', 'cafe'], ['prop', 'letter'], ['prop', 'cream']] as const) {
      await s.call('import_refs', { series_id: SID, entity_type: type, entity_id: id, files: [png] });
      const lock = await s.call('lock_asset', { series_id: SID, entity_type: type, entity_id: id });
      expect(lock.isError, lock.text).toBe(false);
    }
    const g2 = await s.call('approve_gate', { series_id: SID, gate: 'G2' });
    expect(g2.isError, g2.text).toBe(false);
  }, 60_000);

  it('episodes 1-10: continuity errors are blocked, state carries into prompts, product rules hold', async () => {
    const promptOf = async (n: number) => {
      const c = await s.call<{ batches: Array<{ prompt: string }> }>('compile_prompts', { series_id: SID, episode: n });
      expect(c.isError, c.text).toBe(false);
      return c.data.batches.map((b) => b.prompt).join('\n');
    };
    // ep1: default wardrobe
    expect((await s.call('write_script', { series_id: SID, ...fixtureScript, episode: 1 })).isError).toBe(false);
    expect((await s.call('write_shots', { series_id: SID, ...epShots(1) })).isError).toBe(false);
    expect(await promptOf(1)).toContain('wearing white shirt, navy pleated skirt');
    expect((await s.call('update_continuity', { series_id: SID, episode: 1 })).isError).toBe(false);

    // ep2: mina changes into the funeral dress (last shot) and gets a cut
    expect((await s.call('write_shots', { series_id: SID, ...epShots(2, (sh) => (sh.id.endsWith('s006') ? minaWears('funeral')(sh) : sh)) })).isError).toBe(false);
    expect(await promptOf(2)).toContain('wearing white shirt'); // ep1 ended in default wardrobe
    const c2 = await s.call<{ entry: { states: Record<string, { wardrobe?: string; injury?: string }> } }>('update_continuity', { series_id: SID, episode: 2, states: { mina: { injury: 'cut on right palm', state: 'รู้ความลับแล้ว' } } });
    expect(c2.isError, c2.text).toBe(false);
    expect(c2.data.entry.states['mina']).toMatchObject({ wardrobe: 'funeral', injury: 'cut on right palm' });

    // ep3 (bridge episode): default wardrobe on first appearance is a continuity error; bridge shot with the product is required
    const bad3 = await s.call('write_shots', { series_id: SID, ...epShots(3, withBridge) });
    expect(bad3.isError).toBe(true);
    expect(bad3.text).toContain('ตอนที่แล้ว mina จบด้วยชุด "funeral"');
    const noBridge3 = await s.call('write_shots', { series_id: SID, ...epShots(3, minaWears('funeral')) });
    expect(noBridge3.isError).toBe(true);
    expect(noBridge3.text).toContain('bridge');
    const ok3 = await s.call('write_shots', { series_id: SID, ...epShots(3, (sh, i) => withBridge(minaWears('funeral')(sh), i)) });
    expect(ok3.isError, ok3.text).toBe(false);
    const p3 = await promptOf(3);
    expect(p3).toContain('wearing black dress, pearl earrings, visible cut on right palm');
    expect(p3).toContain('[PROPS] cream: white tube with a blue cap');
    expect((await s.call('update_continuity', { series_id: SID, episode: 3 })).isError).toBe(false);

    // ep4: injury heals (clear), back to default wardrobe during the episode -> allowed because the first shot still matches
    const ok4 = await s.call('write_shots', { series_id: SID, ...epShots(4, (sh) => (sh.id.endsWith('s002') || sh.id.endsWith('s003') ? minaWears('funeral')(sh) : sh)) });
    expect(ok4.isError, ok4.text).toBe(false);
    expect(await promptOf(4)).toContain('visible cut on right palm'); // still carried from ep3 state
    const c4 = await s.call<{ entry: { states: Record<string, { wardrobe?: string; injury?: string }> } }>('update_continuity', { series_id: SID, episode: 4, states: { mina: { injury: '' } } });
    expect(c4.isError, c4.text).toBe(false);
    expect(c4.data.entry.states['mina']).toEqual({ wardrobe: 'default', state: 'รู้ความลับแล้ว' });

    // ep5-10: default wardrobe, bridge shots only in 7 and 10, a stray bridge shot in 5 is rejected
    const bad5 = await s.call('write_shots', { series_id: SID, ...epShots(5, withBridge) });
    expect(bad5.isError).toBe(true);
    expect(bad5.text).toContain('ไม่ใช่ตอนสินค้า');
    for (let n = 5; n <= 10; n++) {
      const r = await s.call('write_shots', { series_id: SID, ...epShots(n, BRIDGE.includes(n) ? withBridge : (x) => x) });
      expect(r.isError, `ep${n}: ${r.text}`).toBe(false);
      const p = await promptOf(n);
      expect(p).not.toContain('visible cut'); // healed in ep4
      expect(p.includes('[PROPS] cream')).toBe(BRIDGE.includes(n));
      expect((await s.call('update_continuity', { series_id: SID, episode: n })).isError).toBe(false);
    }
    const continuity = JSON.parse(readFileSync(file('continuity.json'), 'utf8'));
    expect(continuity.entries.map((e: { after_episode: number }) => e.after_episode)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const res = await s.client.readResource({ uri: `series://${SID}/continuity` });
    expect(JSON.parse(res.contents[0]!.text as string).entries.length).toBe(10);
  }, 180_000);

  it('cost_report: credits per episode vs all-final baseline (flow_ext credits)', async () => {
    for (let n = 1; n <= 10; n++) {
      const g = await s.call('generate', { series_id: SID, episode: n, quality: 'draft' }); // flow_ext: queued (no extension) -> credits recorded
      expect(g.isError, g.text).toBe(false);
    }
    const r = await s.call<{ total_credits: number; total_baseline: number; savings_pct: number; episodes: Array<{ credits: number; batches: number; clip_jobs: { draft: number } }> }>('cost_report', { series_id: SID });
    expect(r.isError, r.text).toBe(false);
    expect(r.data.episodes.length).toBe(10);
    expect(r.data.episodes[0]).toMatchObject({ credits: 60, batches: 3, clip_jobs: { draft: 3 } }); // 3 batches × 20 credits (draft)
    expect(r.data.total_credits).toBe(600);
    expect(r.data.total_baseline).toBe(3000); // 3 × 100 × 10
    expect(r.data.savings_pct).toBe(80);
    expect(r.text).toContain('✅');
  }, 60_000);

  it('assembling a bridge episode adds the product card and the ad label', async () => {
    // manual-style import for ep3 via gen pointers: mark the flow_ext jobs as done with real clips
    const dl = join(s.t.root, 'dl');
    mkdirSync(dl, { recursive: true });
    const jobs = s.t.ctx.jobs.list({ series_id: SID, episode: 3, kind: 'clip' });
    const episodes = new EpisodeService(s.t.ctx);
    for (const j of jobs) {
      const clip = makeClip(join(dl, `${j.batch_id}.mp4`), [['a', 3], ['b', 3.5]], true);
      episodes.attachClip(SID, 3, j, clip); // what the extension bridge does on upload
    }
    expect(s.t.ctx.jobs.list({ series_id: SID, episode: 3, kind: 'clip' }).every((j) => j.status === 'done')).toBe(true);
    const r = await s.call<{ timeline: { segments: Array<{ id: string }>; total_sec: number } }>('assemble', { series_id: SID, episode: 3, quality: 'draft' });
    expect(r.isError, r.text).toBe(false);
    expect(r.data.timeline.segments.map((x) => x.id)).toEqual(['title', 'b01', 'b02', 'b03', 'product', 'end']);
    expect(r.data.timeline.total_sec).toBe(2 + 6.5 * 3 + 4 + 3);
    expect(existsSync(file('episodes/ep03/edit/_cards/ad_label.txt'))).toBe(true);
    expect(readFileSync(file('episodes/ep03/edit/_cards/product.txt'), 'utf8')).toBe('ครีมกันแดด X');
  }, 180_000);
});
