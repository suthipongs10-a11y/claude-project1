import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { studioClient } from './mcpClient.js';

/**
 * M1 acceptance: build a 3-episode test series through the MCP tools exactly as Claude would,
 * and check the project folder matches SPEC §6.
 */
describe('M1 demo: 3-episode series from chat', () => {
  let s: Awaited<ReturnType<typeof studioClient>>;
  const SID = 'cafe-secret';
  beforeAll(async () => {
    s = await studioClient();
  });
  afterAll(async () => {
    await s.close();
  });

  const file = (...p: string[]) => join(s.t.ctx.store.seriesDir(SID), ...p);

  it('lists tools, resources and prompts', async () => {
    const tools = (await s.client.listTools()).tools.map((t) => t.name);
    for (const name of ['list_styles', 'list_series', 'create_series', 'get_series', 'write_bible', 'gen_reference', 'import_refs', 'lock_asset', 'unlock_asset', 'write_outline', 'check_gate', 'approve_gate'])
      expect(tools).toContain(name);
    const prompts = (await s.client.listPrompts()).prompts.map((p) => p.name);
    expect(prompts).toContain('plan_series');
    const templates = (await s.client.listResourceTemplates()).resourceTemplates.map((r) => r.uriTemplate);
    expect(templates).toContain('series://{id}/bible');
  });

  it('create_series writes series.json, continuity.json, cost.json and the episode skeleton', async () => {
    const bad = await s.call('create_series', { id: SID, title: 'x', logline: 'y', style_id: 'live_kdrama_dub', aspect: '4:3', episodes: 3, ep_length_sec: 90 });
    expect(bad.isError).toBe(true);
    const r = await s.call<{ series_id: string }>('create_series', {
      id: SID, title: 'ความลับหน้าคาเฟ่', logline: 'บาริสต้าสาวพบว่าลูกค้าประจำคือคนที่เธอตามหามาทั้งชีวิต',
      style_id: 'live_kdrama_dub', aspect: '9:16', episodes: 3, ep_length_sec: 90,
    });
    expect(r.isError).toBe(false);
    expect(r.data.series_id).toBe(SID);
    for (const f of ['series.json', 'continuity.json', 'cost.json', 'episodes/ep01/state.json', 'episodes/ep03/state.json', 'bible/characters', 'episodes/ep02/batches', 'episodes/ep02/gen', 'episodes/ep02/qc', 'episodes/ep02/edit', 'episodes/ep02/final'])
      expect(existsSync(file(f)), f).toBe(true);
    const dup = await s.call('create_series', { id: SID, title: 'x', logline: 'y', style_id: 'live_kdrama_dub', aspect: '9:16', episodes: 1, ep_length_sec: 60 });
    expect(dup.isError).toBe(true);
    expect(dup.text).toContain('มีซีรีส์');
  });

  const characters = [
    { id: 'mina', name: 'มีนา', role: 'นางเอก', age: 27, look: 'long straight black hair, small mole under left eye, medium height', wardrobe_default: 'white shirt, navy pleated skirt', wardrobe_variants: { funeral: 'black dress' }, personality: 'เก็บอารมณ์ ประชดเก่ง', speech: { self: 'ฉัน', to_elder: 'หนู', to_lover: 'เรา', particles: 'ค่ะ/คะ' }, voice_id: 'v_mina' },
    { id: 'tan', name: 'ตั้น', role: 'พระเอก', age: 29, look: 'short dark hair, tall, thin scar on left eyebrow', wardrobe_default: 'grey hoodie, black jeans', personality: 'พูดน้อย', speech: { self: 'ผม', particles: 'ครับ' } },
  ];
  const locations = [{ id: 'cafe', name: 'คาเฟ่หน้ามหาลัย', look: 'small cafe with big west-facing windows and a wooden counter', time_variants: ['day', 'night'], light_sources: ['west window', 'pendant lamps over counter'], axis_notes: 'counter always screen-left' }];
  const props = [{ id: 'letter', name: 'จดหมาย', look: 'old cream envelope with red wax seal' }];

  it('write_bible validates then writes story.md, entity files and voices.json', async () => {
    const bad = await s.call('write_bible', { series_id: SID, story_md: '# story', characters: [{ ...characters[0], look: 'looks exactly like Elsa' }], locations, props });
    expect(bad.isError).toBe(true);
    expect(bad.text).toContain('คำที่ห้ามใช้');
    expect(existsSync(file('bible/story.md'))).toBe(false);

    const r = await s.call<{ written: string[] }>('write_bible', { series_id: SID, story_md: '# ความลับหน้าคาเฟ่\n\nlogline...\n', characters, locations, props, voices: { mina: { voice_id: 'v_mina' }, NARRATOR: { voice_id: 'v_narr' } } });
    expect(r.isError).toBe(false);
    expect(r.data.written).toEqual(expect.arrayContaining(['bible/story.md', 'bible/characters/mina.json', 'bible/characters/tan.json', 'bible/locations/cafe.json', 'bible/props/letter.json', 'bible/voices.json']));
    const mina = JSON.parse(readFileSync(file('bible/characters/mina.json'), 'utf8'));
    expect(mina.locked).toBe(false);
    expect(mina.refs).toEqual([]);
  });

  it('write_outline enforces hook/cliffhanger and reports remaining episodes', async () => {
    const beats = (n: number) => [
      { id: 'hook', type: 'hook', summary: `ตอน ${n} เปิดด้วยเสียงแก้วแตก`, est_sec: 5 },
      { id: 'setup', type: 'setup', summary: 'เช้าปกติ', est_sec: 20 },
      { id: 'conflict', type: 'conflict', summary: 'เขาเดินเข้ามา', est_sec: 25 },
      { id: 'mystery', type: 'mystery', summary: 'เขาจำเธอได้?', est_sec: 20 },
      { id: 'twist', type: 'twist', summary: 'เขาเรียกชื่อเดิมของเธอ', est_sec: 12 },
      { id: 'cliff', type: 'cliffhanger', summary: 'จดหมายบนเคาน์เตอร์', est_sec: 8 },
    ];
    const bad = await s.call('write_outline', { series_id: SID, episode: 1, title: 'x', synopsis: 'y', cliffhanger: 'z', beats: beats(1).slice(1) });
    expect(bad.isError).toBe(true);
    expect(bad.text).toContain('hook');
    for (const n of [1, 2, 3]) {
      const r = await s.call<{ episodes_without_outline: number[] }>('write_outline', { series_id: SID, episode: n, title: `ตอนที่ ${n}`, synopsis: 'สรุป', cliffhanger: 'จดหมาย', beats: beats(n) });
      expect(r.isError).toBe(false);
      expect(r.data.episodes_without_outline).toEqual([1, 2, 3].filter((x) => x > n));
      expect(existsSync(file(`episodes/ep0${n}/outline.json`))).toBe(true);
    }
    const out = await s.call('write_outline', { series_id: SID, episode: 4, title: 'x', synopsis: 'y', cliffhanger: 'z', beats: beats(4) });
    expect(out.isError).toBe(true);
  });

  it('approve_gate G1 passes only when bible + all outlines are valid', async () => {
    const g2early = await s.call('approve_gate', { series_id: SID, gate: 'G2' });
    expect(g2early.isError).toBe(true);
    expect(g2early.text).toContain('G1');
    const g1 = await s.call<{ series_status: string }>('approve_gate', { series_id: SID, gate: 'G1', note: 'ผู้ใช้อนุมัติในแชท' });
    expect(g1.isError).toBe(false);
    expect(g1.data.series_status).toBe('bible_approved');
    const series = JSON.parse(readFileSync(file('series.json'), 'utf8'));
    expect(series.gates.G1.approved).toBe(true);
    expect(series.gates.G1.via).toBe('chat');
  });

  it('gen_reference writes a prompt sheet and jobs; import_refs stores versioned refs; lock/unlock behave', async () => {
    const gen = await s.call<{ job_ids: string[]; jobs: Array<{ view: string; prompt: string; status: string }> }>('gen_reference', { series_id: SID, entity_type: 'character', entity_id: 'mina' });
    expect(gen.isError).toBe(false);
    expect(gen.data.jobs.map((j) => j.view)).toEqual(['front', '3/4', 'side', 'full body', 'expression: happy', 'expression: angry', 'expression: sad']);
    expect(gen.data.jobs[0]?.status).toBe('awaiting_import');
    expect(gen.data.jobs[0]?.prompt).toContain('long straight black hair');
    expect(existsSync(file('bible/characters/mina/ref_prompts_v1.md'))).toBe(true);

    const png = join(s.t.root, 'mina_front.png');
    writeFileSync(png, 'fake-png');
    const lockEarly = await s.call('lock_asset', { series_id: SID, entity_type: 'character', entity_id: 'mina' });
    expect(lockEarly.isError).toBe(true);
    expect(lockEarly.text).toContain('ยังไม่มีภาพอ้างอิง');

    const imp = await s.call<{ added: string[] }>('import_refs', { series_id: SID, entity_type: 'character', entity_id: 'mina', files: [png], job_id: gen.data.job_ids[0] });
    expect(imp.isError).toBe(false);
    expect(imp.data.added).toEqual(['bible/characters/mina/refs/v1/mina_front.png']);
    expect(s.t.ctx.jobs.get(gen.data.job_ids[0]!)?.status).toBe('done');

    const lock = await s.call('lock_asset', { series_id: SID, entity_type: 'character', entity_id: 'mina' });
    expect(lock.isError).toBe(false);
    const again = await s.call('import_refs', { series_id: SID, entity_type: 'character', entity_id: 'mina', files: [png] });
    expect(again.isError).toBe(true);
    expect(again.text).toContain('lock');

    // write_bible may not change a locked character's look
    const relook = await s.call('write_bible', { series_id: SID, story_md: '# story', characters: [{ ...characters[0], look: 'different' }, characters[1]], locations, props });
    expect(relook.isError).toBe(true);
    expect(relook.text).toContain('ถูก lock');
    // but may change personality, and keeps refs/lock state
    const okEdit = await s.call('write_bible', { series_id: SID, story_md: '# story v2', characters: [{ ...characters[0], personality: 'อ่อนโยนขึ้น' }, characters[1]], locations, props });
    expect(okEdit.isError).toBe(false);
    const mina = JSON.parse(readFileSync(file('bible/characters/mina.json'), 'utf8'));
    expect(mina.locked).toBe(true);
    expect(mina.refs.length).toBe(1);
    expect(mina.personality).toBe('อ่อนโยนขึ้น');

    const unlock = await s.call<{ entity: { ref_version: number; locked: boolean } }>('unlock_asset', { series_id: SID, entity_type: 'character', entity_id: 'mina' });
    expect(unlock.data.entity.ref_version).toBe(2);
    const imp2 = await s.call<{ added: string[] }>('import_refs', { series_id: SID, entity_type: 'character', entity_id: 'mina', files: [png], replace: true });
    expect(imp2.data.added).toEqual(['bible/characters/mina/refs/v2/mina_front.png']);
    expect(existsSync(file('bible/characters/mina/refs/v1/mina_front.png'))).toBe(true); // old version kept
  });

  it('approve_gate G2 requires every asset locked, then series is assets_locked', async () => {
    const before = await s.call<{ check: { blockers: string[] } }>('check_gate', { series_id: SID, gate: 'G2' });
    expect(before.data.check.blockers.length).toBeGreaterThan(0);
    const png = join(s.t.root, 'ref.png');
    writeFileSync(png, 'fake-png');
    for (const [type, id] of [['character', 'mina'], ['character', 'tan'], ['location', 'cafe'], ['prop', 'letter']] as const) {
      const imp = await s.call('import_refs', { series_id: SID, entity_type: type, entity_id: id, files: [png] });
      expect(imp.isError, imp.text).toBe(false);
      const lock = await s.call('lock_asset', { series_id: SID, entity_type: type, entity_id: id });
      expect(lock.isError, lock.text).toBe(false);
    }
    const g2 = await s.call<{ series_status: string }>('approve_gate', { series_id: SID, gate: 'G2', via: 'dashboard' });
    expect(g2.isError, g2.text).toBe(false);
    expect(g2.data.series_status).toBe('assets_locked');
  });

  it('get_series and resources reflect the state', async () => {
    const r = await s.call<{ series: { status: string }; episodes: Array<{ has_outline: boolean }>; bible: { characters: Array<{ locked: boolean }> } }>('get_series', { series_id: SID });
    expect(r.data.series.status).toBe('assets_locked');
    expect(r.data.episodes.every((e) => e.has_outline)).toBe(true);
    expect(r.data.bible.characters.every((c) => c.locked)).toBe(true);
    expect(r.text).toContain('G1 ✅');

    const bible = await s.client.readResource({ uri: `series://${SID}/bible` });
    expect(JSON.parse(bible.contents[0]!.text as string).characters.length).toBe(2);
    const outline = await s.client.readResource({ uri: `series://${SID}/ep/2/outline` });
    expect(JSON.parse(outline.contents[0]!.text as string).episode).toBe(2);
    const list = await s.client.listResources();
    expect(list.resources.map((x) => x.uri)).toContain(`series://${SID}/bible`);

    const prompt = await s.client.getPrompt({ name: 'plan_series', arguments: { idea: 'คาเฟ่ลับ', episodes: '3' } });
    expect((prompt.messages[0]!.content as { text: string }).text).toContain('create_series');
  });

  it('final folder layout matches SPEC §6', () => {
    for (const f of [
      'series.json', 'continuity.json', 'cost.json',
      'bible/story.md', 'bible/voices.json',
      'bible/characters/mina.json', 'bible/characters/mina/refs/v2/mina_front.png',
      'bible/locations/cafe.json', 'bible/locations/cafe/refs/v1/ref.png',
      'bible/props/letter.json',
      'episodes/ep01/outline.json', 'episodes/ep02/outline.json', 'episodes/ep03/outline.json',
    ]) expect(existsSync(file(f)), f).toBe(true);
  });
});
