/**
 * Continue the demo (after seed-demo.ts): G1 -> placeholder refs -> G2 -> episode 1 script, shots,
 * prompts, manual jobs, synthetic clips, QC, G3, (optional) real TTS dub, final assembly.
 * Run: pnpm --filter @series-studio/server exec tsx scripts/seed-episode1.ts
 * Env: DEMO_TTS=cartesia to use real Cartesia voices (needs CARTESIA_API_KEY or an auth proxy).
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const home = process.env['SERIES_STUDIO_HOME'] ?? root;
const SID = process.env['DEMO_SERIES_ID'] ?? 'cafe-secret';
const TTS = process.env['DEMO_TTS'] ?? 'mock';
const tmp = join(home, 'data', 'demo-tmp');
mkdirSync(tmp, { recursive: true });

function png(name: string, label: string, color: string): string {
  const file = join(tmp, `${name}.png`);
  const txt = join(tmp, `${name}.txt`);
  writeFileSync(txt, label);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${color}:s=768x1024`, '-vf', `drawtext=textfile='${txt}':font='Noto Sans Thai':fontsize=56:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2`, '-frames:v', '1', file]);
  if (r.status !== 0) throw new Error(String(r.stderr));
  return file;
}

function clip(name: string, segments: Array<[string, number]>): string {
  const file = join(tmp, `${name}.mp4`);
  const inputs: string[] = [];
  const filt: string[] = [];
  segments.forEach(([kind, sec], i) => {
    const src = kind === 'a' ? `testsrc2=size=720x1280:rate=24:duration=${sec}` : kind === 'b' ? `mandelbrot=size=720x1280:rate=24,trim=duration=${sec}` : `life=size=720x1280:rate=24:ratio=0.3:mold=10,trim=duration=${sec}`;
    inputs.push('-f', 'lavfi', '-i', src);
    filt.push(`[${i}:v]format=yuv420p,setsar=1[v${i}]`);
  });
  const total = segments.reduce((s, [, d]) => s + d, 0);
  inputs.push('-f', 'lavfi', '-i', `anoisesrc=color=brown:amplitude=0.02:duration=${total}`);
  filt.push(segments.map((_, i) => `[v${i}]`).join('') + `concat=n=${segments.length}:v=1:a=0[outv]`);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', filt.join(';'), '-map', '[outv]', '-map', `${segments.length}:a`, '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', file]);
  if (r.status !== 0) throw new Error(String(r.stderr));
  return file;
}

type Char = { id: string; screen_pos: 'left' | 'center' | 'right'; emotion: string; wardrobe?: string };
type Cue = { char: string; text: string; t_start: number; t_end: number };
let n = 0;
function shot(scene: number, dur: number, type: string, angle: string, lens: string, movement: string, axis: 'A' | 'B', chars: Char[], loc: string, time: string, light: string, action: string, purpose: string, beat: string, dialogue: Cue[] = [], extra: Record<string, unknown> = {}) {
  n += 1;
  return { id: `ep01_s${String(n).padStart(3, '0')}`, scene, duration_sec: dur, type, angle, lens, movement, axis_side: axis, characters: chars, location: loc, time, light_motivation: light, action, purpose, beat, dialogue, sfx: [], ...extra };
}
const M = (emotion: string, pos: Char['screen_pos'] = 'left'): Char => ({ id: 'mina', screen_pos: pos, emotion });
const T = (emotion: string, pos: Char['screen_pos'] = 'right'): Char => ({ id: 'tan', screen_pos: pos, emotion });
const K = (emotion: string, pos: Char['screen_pos'] = 'right'): Char => ({ id: 'kaew', screen_pos: pos, emotion });
const L = 'west window, key from screen-right, warm pendant fill';

const shots = [
  // scene 1 — hook (9s)
  shot(1, 3, 'INSERT', 'top-down', '50mm', 'static', 'A', [], 'cafe', 'day', L, 'a ceramic coffee cup slips and shatters on the wooden counter, coffee splashing', 'hook: something just broke', 'hook'),
  shot(1, 3, 'CU', 'eye-level', '85mm', 'slow push-in', 'A', [M('frozen, breath held')], 'cafe', 'day', L, 'mina stares past the camera toward the door, not blinking', 'her reaction sells the hook', 'hook'),
  shot(1, 3, 'WS', 'eye-level', '35mm', 'static', 'A', [M('small and still', 'left'), T('calm, just stepped in', 'right')], 'cafe', 'day', L, 'the door bell is still swinging; tan stands in the doorway, mina behind the counter', 'reveal who walked in', 'hook'),
  // scene 2 — setup, 10 minutes earlier (22s)
  shot(2, 4, 'WS', 'eye-level', '35mm', 'slow lateral track', 'A', [M('relaxed, humming', 'left')], 'cafe', 'day', 'morning sun through west window, soft', 'title text-free: mina wipes the counter, steam from the espresso machine, empty cafe', 'establish the calm before', 'setup'),
  shot(2, 4, 'MS', 'eye-level', '50mm', 'static', 'A', [K('bossy but fond', 'right')], 'cafe', 'day', L, 'kaew pushes the door open with her hip, waving a rent notebook', 'introduce kaew and the money pressure', 'setup', [{ char: 'kaew', text: 'มีนา วันนี้วันที่สิบแล้วนะ', t_start: 0.6, t_end: 2.8 }]),
  shot(2, 4, 'OTS', 'eye-level', '50mm', 'static', 'A', [K('smirking', 'right'), M('mock-innocent', 'left')], 'cafe', 'day', L, 'over kaew\'s shoulder: mina slides an envelope of cash across the counter without looking up', 'their routine, mina pays on time', 'setup', [{ char: 'mina', text: 'หนูนับไว้แล้วค่ะป้า ครบ', t_start: 0.5, t_end: 2.4 }]),
  shot(2, 4, 'CU', 'eye-level', '85mm', 'static', 'A', [K('teasing', 'right')], 'cafe', 'day', L, 'kaew leans in, eyebrows up, glasses sliding down her nose', 'kaew plants the mystery customer', 'setup', [{ char: 'kaew', text: 'แล้วหนุ่มหน้าเศร้าที่มาทุกเช้าล่ะ สั่งแต่อเมริกาโน่', t_start: 0.4, t_end: 3.6 }]),
  shot(2, 3, 'MCU', 'eye-level', '85mm', 'static', 'A', [M('deflecting, too quick')], 'cafe', 'day', L, 'mina turns to the grinder so kaew cannot see her face', 'mina hides something', 'setup', [{ char: 'mina', text: 'ลูกค้าก็ลูกค้าค่ะ', t_start: 0.5, t_end: 2.0 }]),
  shot(2, 3, 'INSERT', 'eye-level', '85mm', 'static', 'A', [], 'cafe', 'day', 'pendant lamp', 'the wall clock ticks to 8:59; a fresh cup is set on the counter', 'time jump to the hook moment', 'setup'),
  // scene 3 — conflict (24s)
  shot(3, 4, 'WS', 'eye-level', '35mm', 'static', 'A', [M('turning around', 'left'), T('quiet', 'right')], 'cafe', 'day', L, 'the bell rings; tan steps in and closes the door gently behind him', 'he arrives', 'conflict'),
  shot(3, 3, 'CU', 'eye-level', '85mm', 'static', 'A', [M('recognition, fear held in')], 'cafe', 'day', L, 'mina\'s eyes flick to his face and away; her jaw tightens', 'she knows him', 'conflict'),
  shot(3, 4, 'MS', 'eye-level', '50mm', 'static', 'A', [T('polite, watching her')], 'cafe', 'day', L, 'tan rests both hands on the counter edge', 'his order is a ritual', 'conflict', [{ char: 'tan', text: 'อเมริกาโน่ร้อน ไม่หวาน ครับ', t_start: 0.6, t_end: 2.6 }]),
  shot(3, 4, 'CU', 'high angle', '85mm', 'static', 'A', [M('hands trembling')], 'cafe', 'day', 'pendant lamp, hard top light on hands', 'mina tamps the espresso; the portafilter rattles in her hands', 'her body betrays her', 'conflict'),
  shot(3, 3, 'INSERT', 'eye-level', '85mm', 'slow push-in', 'A', [], 'cafe', 'day', 'pendant lamp', 'coffee streams into a white cup, too fast, spilling a little', 'tension in a detail', 'conflict'),
  shot(3, 3, 'OTS', 'eye-level', '50mm', 'static', 'B', [M('composing herself', 'right'), T('patient', 'left')], 'cafe', 'day', 'west window now behind tan, rim light', 'from behind mina: tan has not moved, still watching', 'he is not leaving', 'conflict', [{ char: 'mina', text: 'ค่ะ สักครู่นะคะ', t_start: 0.6, t_end: 2.2 }]),
  shot(3, 3, 'MCU', 'eye-level', '85mm', 'static', 'B', [T('a flicker of hope')], 'cafe', 'day', 'west window rim light', 'tan almost smiles at her voice', 'he recognises her voice', 'conflict'),
  // scene 4 — mystery (18s)
  shot(4, 4, 'MS', 'eye-level', '50mm', 'static', 'B', [T('careful, gentle')], 'cafe', 'day', 'west window rim light', 'tan takes the cup, does not drink, looks at her', 'the question that tests her lie', 'mystery', [{ char: 'tan', text: 'คุณเคยอยู่เชียงใหม่ไหมครับ', t_start: 0.5, t_end: 2.6 }]),
  shot(4, 4, 'CU', 'eye-level', '85mm', 'static', 'B', [M('lying, steady voice', 'right')], 'cafe', 'day', 'west window rim light', 'mina wipes the same spot on the counter twice', 'she lies to his face', 'mystery', [{ char: 'mina', text: 'ไม่เคยค่ะ ฉันเป็นคนที่นี่', t_start: 0.6, t_end: 2.7 }]),
  shot(4, 4, 'CU', 'eye-level', '85mm', 'static', 'B', [T('sad smile')], 'cafe', 'day', 'west window rim light', 'tan nods slowly, looks down at the cup', 'he accepts the lie, for now', 'mystery', [{ char: 'tan', text: 'ครับ ผมคงจำผิดคน', t_start: 0.5, t_end: 2.4 }]),
  shot(4, 3, 'INSERT', 'eye-level', '50mm', 'static', 'A', [], 'cafe', 'day', 'pendant lamp', 'through the storeroom door gap, kaew\'s glasses glint as she watches', 'kaew knows too; neutral cut resets the axis', 'mystery'),
  shot(4, 3, 'WS', 'eye-level', '35mm', 'static', 'A', [M('still', 'left'), T('still', 'right')], 'cafe', 'day', L, 'the two of them on either side of the counter, the untouched cup between them', 'the distance between them', 'mystery'),
  // scene 5 — twist (12s)
  shot(5, 4, 'MS', 'eye-level', '50mm', 'static', 'A', [T('resolved', 'right')], 'cafe', 'day', L, 'tan takes a cream envelope from his jacket and lays it on the counter', 'the letter appears', 'twist', [{ char: 'tan', text: 'ของคุณ', t_start: 1.0, t_end: 1.8 }], { props: ['letter'] }),
  shot(5, 4, 'CU', 'eye-level', '85mm', 'slow push-in', 'A', [M('staring at the envelope')], 'cafe', 'day', L, 'mina does not touch it; her hand hovers over the wax seal', 'she is afraid of the letter', 'twist', [], { props: ['letter'] }),
  shot(5, 4, 'WS', 'eye-level', '35mm', 'static', 'A', [M('alone', 'left')], 'cafe', 'day', L, 'tan is gone; the door bell swings; the cup still steams on the counter', 'he left without an answer', 'twist'),
  // scene 6 — cliffhanger (8s)
  shot(6, 3, 'INSERT', 'top-down', '85mm', 'static', 'A', [], 'cafe', 'day', 'pendant lamp', 'the envelope: yellowed cream paper, cracked red wax seal', 'the object of the season', 'cliffhanger', [], { props: ['letter'] }),
  shot(6, 2, 'ECU', 'eye-level', '85mm', 'static', 'A', [M('decision forming')], 'cafe', 'day', L, 'mina\'s eyes, a single blink', 'she decides to look', 'cliffhanger'),
  shot(6, 3, 'INSERT', 'top-down', '85mm', 'slow push-in', 'A', [], 'cafe', 'day', 'pendant lamp', 'her hand flips the envelope over: the address is written in her own handwriting, freeze frame', 'cliffhanger: her own handwriting from 7 years ago', 'cliffhanger', [], { props: ['letter'] }),
];

const script = {
  episode: 1,
  scenes: [
    { scene: 1, location: 'cafe', time: 'day', summary: 'แก้วแตก ตั้นยืนที่ประตู' },
    { scene: 2, location: 'cafe', time: 'day', summary: 'ย้อนไป 10 นาที ป้าแก้วมาเก็บค่าเช่า' },
    { scene: 3, location: 'cafe', time: 'day', summary: 'ตั้นสั่งกาแฟ มีนามือสั่น' },
    { scene: 4, location: 'cafe', time: 'day', summary: 'คำถามเรื่องเชียงใหม่' },
    { scene: 5, location: 'cafe', time: 'day', summary: 'จดหมายบนเคาน์เตอร์' },
    { scene: 6, location: 'cafe', time: 'day', summary: 'ลายมือตัวเอง' },
  ],
  lines: [
    { id: 'l01', scene: 2, char: 'kaew', text: 'มีนา วันนี้วันที่สิบแล้วนะ', emotion: 'ทวงแบบเอ็นดู' },
    { id: 'l02', scene: 2, char: 'mina', text: 'หนูนับไว้แล้วค่ะป้า ครบ', emotion: 'ไม่สบตา' },
    { id: 'l03', scene: 2, char: 'kaew', text: 'แล้วหนุ่มหน้าเศร้าที่มาทุกเช้าล่ะ สั่งแต่อเมริกาโน่', emotion: 'แซว' },
    { id: 'l04', scene: 2, char: 'mina', text: 'ลูกค้าก็ลูกค้าค่ะ', emotion: 'ตัดบท' },
    { id: 'l05', scene: 3, char: 'tan', text: 'อเมริกาโน่ร้อน ไม่หวาน ครับ', emotion: 'นิ่ง' },
    { id: 'l06', scene: 3, char: 'mina', text: 'ค่ะ สักครู่นะคะ', emotion: 'ฝืนเสียงให้ปกติ' },
    { id: 'l07', scene: 4, char: 'tan', text: 'คุณเคยอยู่เชียงใหม่ไหมครับ', emotion: 'ระวังคำ' },
    { id: 'l08', scene: 4, char: 'mina', text: 'ไม่เคยค่ะ ฉันเป็นคนที่นี่', emotion: 'โกหกเสียงเรียบ' },
    { id: 'l09', scene: 4, char: 'tan', text: 'ครับ ผมคงจำผิดคน', emotion: 'ยิ้มเศร้า' },
    { id: 'l10', scene: 5, char: 'tan', text: 'ของคุณ', emotion: 'เบาแต่หนัก' },
  ],
};

async function main() {
  const env = { ...process.env, SERIES_STUDIO_NO_HTTP: process.env['SERIES_STUDIO_NO_HTTP'] ?? '1', NODE_USE_ENV_PROXY: process.env['NODE_USE_ENV_PROXY'] ?? '1' };
  const transport = new StdioClientTransport({ command: process.execPath, args: [join(root, 'apps/server/dist/mcp.js')], env, stderr: 'inherit' });
  const client = new Client({ name: 'seed-episode1', version: '0.1.0' });
  await client.connect(transport);
  const call = async (name: string, args: Record<string, unknown>, { allowError = false } = {}) => {
    const res = await client.callTool({ name, arguments: args });
    const text = (res.content as Array<{ type: string; text?: string }>).map((c) => c.text ?? '').join('\n');
    console.log(`${res.isError ? '✗' : '✓'} ${name}: ${(text.split('\n')[0] ?? '').slice(0, 170)}`);
    if (res.isError && !allowError) {
      console.log(text);
      throw new Error(`${name} failed`);
    }
    return { text, data: (res.structuredContent ?? {}) as Record<string, unknown>, isError: res.isError === true };
  };

  // --- G1 + refs + G2
  await call('approve_gate', { series_id: SID, gate: 'G1', note: 'demo: อนุมัติจากสคริปต์' }, { allowError: true });
  const refs: Array<['character' | 'location' | 'prop', string, string, string]> = [
    ['character', 'mina', 'มีนา', '0x6b4a7a'], ['character', 'tan', 'ตั้น', '0x2f4858'], ['character', 'kaew', 'ป้าแก้ว', '0x8a5a2b'],
    ['location', 'cafe', 'คาเฟ่', '0x3a4a2a'], ['location', 'street', 'ถนน', '0x1a1a2e'], ['location', 'backroom', 'ห้องหลังร้าน', '0x2a2a2a'], ['prop', 'letter', 'จดหมาย', '0x7a6a4a'],
  ];
  for (const [type, id, label, color] of refs) {
    await call('gen_reference', { series_id: SID, entity_type: type, entity_id: id });
    const files = type === 'character' ? ['front', 'side'].map((v) => png(`${id}_${v}`, `${label} (${v})`, color)) : [png(`${id}_wide`, `${label}`, color)];
    await call('import_refs', { series_id: SID, entity_type: type, entity_id: id, files, replace: true });
    await call('lock_asset', { series_id: SID, entity_type: type, entity_id: id });
  }
  await call('approve_gate', { series_id: SID, gate: 'G2' }, { allowError: true });

  // --- episode 1
  await call('write_script', { series_id: SID, ...script });
  const ws = await call('write_shots', { series_id: SID, episode: 1, shots });
  const plan = (ws.data['batches_preview'] as Array<{ id: string; shot_ids: string[]; total_sec: number }>) ?? [];
  await call('compile_prompts', { series_id: SID, episode: 1 });
  await call('export_prompt_sheet', { series_id: SID, episode: 1, quality: 'draft' });
  await call('generate', { series_id: SID, episode: 1, quality: 'draft' });
  // synthetic stand-in clips (one per batch, a visible cut per shot)
  const dl = join(tmp, 'clips');
  mkdirSync(dl, { recursive: true });
  const kinds = ['a', 'b', 'c'];
  for (const b of plan) {
    const segs = b.shot_ids.map((sid, i): [string, number] => [kinds[i % 3]!, shots.find((s) => s.id === sid)!.duration_sec]);
    clip(join('clips', b.id), segs);
  }
  await call('import_clips', { series_id: SID, episode: 1, folder: dl });
  const qc = await call('run_qc', { series_id: SID, episode: 1 });
  console.log(qc.text.split('\n').slice(0, 6).join('\n'));
  for (const r of (qc.data['results'] as Array<{ shot_id: string; pass: boolean }>) ?? []) {
    if (!r.pass) await call('review_shot', { series_id: SID, episode: 1, shot_id: r.shot_id, pass: true, reason: 'demo clip (stand-in) ยอมรับ', by: 'human' });
  }
  await call('approve_gate', { series_id: SID, gate: 'G3', episode: 1 });

  // --- voices + dub
  const voices = await call('list_voices', { provider: TTS, lang: 'th' }, { allowError: true });
  const list = ((voices.data['voices'] as Array<{ id: string; gender?: string; name: string }>) ?? []);
  let pick = (gender: string, fallback: number) => list.find((v) => v.gender === gender)?.id ?? list[fallback % Math.max(list.length, 1)]?.id ?? 'mock_female_1';
  if (TTS === 'cartesia') {
    const all = await call('list_voices', { provider: 'cartesia', lang: '' }, { allowError: true });
    const every = ((all.data['voices'] as Array<{ id: string; gender?: string; lang?: string }>) ?? []);
    const male = every.find((v) => v.gender === 'masculine')?.id;
    pick = (gender: string, fallback: number) => (gender === 'masculine' && male ? male : list[fallback % Math.max(list.length, 1)]?.id ?? 'mock_female_1');
  }
  await call('assign_voice', { series_id: SID, character_id: 'mina', voice_id: pick('feminine', 0), provider: TTS, lang: 'th' });
  await call('assign_voice', { series_id: SID, character_id: 'kaew', voice_id: pick('feminine', 1), provider: TTS, lang: 'th' });
  await call('assign_voice', { series_id: SID, character_id: 'tan', voice_id: pick('masculine', 0), provider: TTS, lang: 'th' });
  const dub = await call('dub_episode', { series_id: SID, episode: 1, provider: TTS });
  console.log(dub.text.split('\n').slice(0, 4).join('\n'));

  // --- final
  const fin = await call('assemble', { series_id: SID, episode: 1, quality: 'final' });
  console.log(fin.text);
  await call('approve_gate', { series_id: SID, gate: 'G4', episode: 1 });
  await call('update_continuity', { series_id: SID, episode: 1, states: { mina: { holding: 'the letter', state: 'รู้แล้วว่าตั้นคือคนนั้น' } } });
  await call('cost_report', { series_id: SID });
  await call('get_series', { series_id: SID });
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
