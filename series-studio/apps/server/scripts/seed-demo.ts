/**
 * Seed a realistic Thai demo series through the real MCP server (stdio), exactly the way Claude
 * Desktop talks to it. Run: pnpm demo  (writes projects/cafe-secret under SERIES_STUDIO_HOME).
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const SID = process.env['DEMO_SERIES_ID'] ?? 'cafe-secret';

async function main() {
  const transport = new StdioClientTransport({ command: process.execPath, args: [join(root, 'apps/server/dist/mcp.js')], env: { ...process.env, SERIES_STUDIO_NO_HTTP: process.env['SERIES_STUDIO_NO_HTTP'] ?? '1' }, stderr: 'inherit' });
  const client = new Client({ name: 'seed-demo', version: '0.1.0' });
  await client.connect(transport);
  const call = async (name: string, args: Record<string, unknown>) => {
    const res = await client.callTool({ name, arguments: args });
    const text = (res.content as Array<{ type: string; text?: string }>).map((c) => c.text ?? '').join('\n');
    const line = text.split('\n')[0] ?? '';
    console.log(`${res.isError ? '✗' : '✓'} ${name}: ${line.slice(0, 160)}`);
    if (res.isError) {
      console.log(text);
      throw new Error(`${name} failed`);
    }
    return { text, data: res.structuredContent as Record<string, unknown> };
  };

  await call('list_styles', {});
  await call('create_series', {
    id: SID,
    title: 'ความลับหน้าคาเฟ่',
    logline: 'บาริสต้าสาวที่หนีอดีตมาเปิดคาเฟ่เล็กๆ หน้ามหาลัย พบว่าลูกค้าประจำผู้เงียบขรึมคือคนที่เธอตามหามาทั้งชีวิต และเขาถือจดหมายที่ไม่ควรมีอยู่',
    style_id: 'live_kdrama_dub',
    aspect: '9:16',
    episodes: 3,
    ep_length_sec: 90,
  });

  await call('write_bible', {
    series_id: SID,
    story_md: [
      '# ความลับหน้าคาเฟ่',
      '',
      '**Logline**: บาริสต้าสาวที่หนีอดีตมาเปิดคาเฟ่เล็กๆ หน้ามหาลัย พบว่าลูกค้าประจำผู้เงียบขรึมคือคนที่เธอตามหามาทั้งชีวิต และเขาถือจดหมายที่ไม่ควรมีอยู่',
      '',
      '**ธีม**: ความลับที่ปิดไว้เพื่อปกป้องคนที่รัก สุดท้ายคือสิ่งที่ทำร้ายเขามากที่สุด',
      '',
      '## Arc ซีซัน (3 ตอน)',
      '1. ลูกค้าคนนั้น: มีนาเจอตั้นอีกครั้ง เขาวางจดหมายไว้บนเคาน์เตอร์',
      '2. จดหมายฉบับที่สอง: มีนาอ่านจดหมาย รู้ว่าตั้นตามหาเธอมา 7 ปี ป้าแก้วเตือนให้หนี',
      '3. ฝนตกหน้าคาเฟ่: มีนาตัดสินใจบอกความจริง แต่ตั้นมาพร้อมคนที่เธอกลัวที่สุด',
    ].join('\n'),
    characters: [
      {
        id: 'mina', name: 'มีนา', role: 'นางเอก บาริสต้าเจ้าของคาเฟ่', age: 27,
        look: 'Thai woman late twenties, long straight black hair tied low, small mole under left eye, slim, medium height, calm tired eyes',
        wardrobe_default: 'white linen shirt with sleeves rolled, dark navy apron, silver thin bracelet on right wrist',
        wardrobe_variants: { rain: 'oversized grey knit cardigan over white shirt, hair down and damp' },
        personality: 'เก็บอารมณ์ พูดน้อย ประชดเบาๆ เวลากลัว',
        speech: { self: 'ฉัน', to_elder: 'หนู', to_lover: 'เรา', particles: 'ค่ะ/คะ' },
      },
      {
        id: 'tan', name: 'ตั้น', role: 'พระเอก ลูกค้าประจำ', age: 29,
        look: 'Thai man late twenties, short neat dark hair, tall and lean, thin scar through left eyebrow, deep-set eyes',
        wardrobe_default: 'charcoal hoodie under an olive field jacket, black jeans, worn leather watch',
        personality: 'นิ่ง อดทน พูดสั้นแต่ตรง',
        speech: { self: 'ผม', to_lover: 'เรา', particles: 'ครับ' },
      },
      {
        id: 'kaew', name: 'ป้าแก้ว', role: 'เจ้าของตึก คนที่ช่วยมีนาซ่อนตัว', age: 58,
        look: 'Thai woman late fifties, short permed grey-streaked hair, round face, reading glasses on a beaded chain',
        wardrobe_default: 'floral cotton blouse, dark trousers, gold bangle',
        personality: 'ปากร้ายใจดี ระวังตัวสูง',
        speech: { self: 'ป้า', particles: 'จ้ะ/ล่ะ' },
      },
    ],
    locations: [
      { id: 'cafe', name: 'คาเฟ่หน้ามหาลัย', look: 'small warm cafe with a long wooden counter on the left, big west-facing window on the right, hanging pendant lamps, chalkboard menu', time_variants: ['day', 'evening', 'night'], light_sources: ['west window', 'pendant lamps over counter'], axis_notes: 'counter always screen-left, door screen-right' },
      { id: 'street', name: 'ถนนหน้าคาเฟ่', look: 'narrow university street at night, wet asphalt reflecting neon shop signs, parked motorbikes', time_variants: ['night'], light_sources: ['neon signs', 'street lamp'], axis_notes: 'cafe door screen-left' },
      { id: 'backroom', name: 'ห้องหลังร้าน', look: 'cramped storeroom behind the cafe, shelves of coffee sacks, single bare bulb, small desk with an old radio', time_variants: ['night'], light_sources: ['bare bulb'] },
    ],
    props: [{ id: 'letter', name: 'จดหมาย', look: 'cream envelope yellowed at the edges, red wax seal cracked in half, handwritten address in blue ink' }],
    voices: { mina: { voice_id: 'pending', lang: 'th' }, tan: { voice_id: 'pending', lang: 'th' }, kaew: { voice_id: 'pending', lang: 'th' } },
  });

  const outlines: Array<Record<string, unknown>> = [
    {
      episode: 1, title: 'ลูกค้าคนนั้น', synopsis: 'เช้าปกติในคาเฟ่จนตั้นเดินเข้ามา มีนาจำเขาได้ทันทีแต่ทำเป็นไม่รู้จัก เขาวางจดหมายซองเก่าไว้บนเคาน์เตอร์แล้วเดินออกไป',
      cliffhanger: 'มีนาพลิกซองจดหมาย เห็นลายมือของตัวเองเมื่อ 7 ปีก่อน',
      beats: [
        { id: 'hook', type: 'hook', summary: 'แก้วกาแฟหลุดจากมือมีนาแตกกระจายเมื่อเสียงกระดิ่งหน้าร้านดัง', est_sec: 6 },
        { id: 'setup', type: 'setup', summary: 'ย้อนไป 10 นาทีก่อน เช้าปกติ ป้าแก้วมาเก็บค่าเช่า แซวเรื่องลูกค้าหนุ่มที่มาทุกวัน', est_sec: 22 },
        { id: 'conflict', type: 'conflict', summary: 'ตั้นเดินเข้ามา สั่งกาแฟแบบเดิม มีนาทำเป็นไม่รู้จัก มือสั่น', est_sec: 24 },
        { id: 'mystery', type: 'mystery', summary: 'ตั้นถามว่าเคยอยู่เชียงใหม่ไหม มีนาปฏิเสธ เขายิ้มเศร้า', est_sec: 18 },
        { id: 'twist', type: 'twist', summary: 'ตั้นวางซองจดหมายบนเคาน์เตอร์ บอกว่าของเธอ แล้วเดินออก', est_sec: 12 },
        { id: 'cliff', type: 'cliffhanger', summary: 'มีนาพลิกซอง เห็นลายมือตัวเอง', est_sec: 8 },
      ],
    },
    {
      episode: 2, title: 'จดหมายฉบับที่สอง', synopsis: 'มีนาอ่านจดหมายในห้องหลังร้าน รู้ว่าตั้นตามหาเธอมา 7 ปี ป้าแก้วเตือนว่าถ้าเขาหาเธอเจอ คนอื่นก็หาเจอได้',
      cliffhanger: 'ป้าแก้วยื่นจดหมายฉบับที่สองที่ส่งมาถึงร้านเมื่อเช้า ลายมือเดียวกัน แต่ไม่ใช่จากตั้น',
      beats: [
        { id: 'hook', type: 'hook', summary: 'มือมีนาสั่นจนจดหมายฉีกตรงมุม', est_sec: 5 },
        { id: 'setup', type: 'setup', summary: 'ค่ำวันเดียวกัน ร้านปิด มีนานั่งในห้องหลังร้านกับจดหมาย', est_sec: 20 },
        { id: 'conflict', type: 'conflict', summary: 'เสียงจดหมายในหัว: ตั้นเล่าว่าตามหาเธอทุกจังหวัดตั้งแต่คืนที่เธอหายไป', est_sec: 25 },
        { id: 'mystery', type: 'mystery', summary: 'ป้าแก้วเข้ามา รู้เรื่องมากกว่าที่ควร เตือนให้มีนาเก็บของหนี', est_sec: 22 },
        { id: 'twist', type: 'twist', summary: 'มีนาปฏิเสธจะหนี บอกว่าครั้งนี้จะไม่ทิ้งเขาอีก', est_sec: 10 },
        { id: 'cliff', type: 'cliffhanger', summary: 'ป้าแก้วยื่นจดหมายฉบับที่สอง ลายมือเดียวกันแต่ส่งจากกรุงเทพ', est_sec: 8 },
      ],
    },
    {
      episode: 3, title: 'ฝนตกหน้าคาเฟ่', synopsis: 'มีนาตัดสินใจบอกความจริงกับตั้นที่หน้าร้านในคืนฝนตก แต่ตั้นมาพร้อมคนที่เธอกลัวที่สุด',
      cliffhanger: 'ประตูรถเปิด ชายในชุดสูทก้าวลงมา มีนาเรียกชื่อเขาว่า พ่อ',
      beats: [
        { id: 'hook', type: 'hook', summary: 'ฝนกระหน่ำ มีนายืนรอหน้าร้านโดยไม่กางร่ม', est_sec: 6 },
        { id: 'setup', type: 'setup', summary: 'มีนาซ้อมคำพูดในกระจกร้าน ป้าแก้วมองจากข้างใน', est_sec: 18 },
        { id: 'conflict', type: 'conflict', summary: 'ตั้นมาถึง มีนาเริ่มสารภาพว่าทำไมหายไป', est_sec: 26 },
        { id: 'mystery', type: 'mystery', summary: 'ตั้นขัดจังหวะ บอกว่ามีคนอยากพบเธอ รถสีดำจอดข้างถนน', est_sec: 18 },
        { id: 'twist', type: 'twist', summary: 'มีนาถอยหลัง ป้าแก้วเปิดประตูร้านพร้อมกุญแจรถ', est_sec: 12 },
        { id: 'cliff', type: 'cliffhanger', summary: 'ชายในชุดสูทลงจากรถ มีนาเรียกเขาว่าพ่อ', est_sec: 10 },
      ],
    },
  ];
  for (const o of outlines) await call('write_outline', { series_id: SID, ...o });
  await call('get_series', { series_id: SID });
  console.log('\nseeded. next: approve G1 from chat/dashboard, then refs.');
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
