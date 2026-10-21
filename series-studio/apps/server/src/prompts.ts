import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { StudioContext } from './context.js';

/** MCP prompt templates (SPEC §9): plan_series (M1), breakdown_episode (M2), fix_failed_shots (M3). */
export function registerPrompts(server: McpServer, ctx: StudioContext): void {
  server.registerPrompt(
    'plan_series',
    {
      title: 'วางแผนซีรีส์ (Stage A → G1)',
      description: 'Guide Claude through Stage A: style, series, bible, outline for every episode, then ask the user for G1.',
      argsSchema: {
        idea: z.string().min(1).describe('ไอเดีย/logline จากผู้ใช้'),
        style_id: z.string().optional().describe('preset id ถ้าผู้ใช้เลือกแล้ว'),
        episodes: z.string().optional().describe('จำนวนตอน'),
        ep_length_sec: z.string().optional().describe('ความยาวต่อตอน (วินาที)'),
        aspect: z.string().optional().describe('9:16 หรือ 16:9'),
      },
    },
    ({ idea, style_id, episodes, ep_length_sec, aspect }) => {
      const styles = [...ctx.presets.values()].map((p) => `${p.id} (${p.label})`).join(', ');
      const text = [
        `คุณคือผู้กำกับของ Series Studio ช่วยวางแผนซีรีส์จากไอเดียนี้: "${idea}"`,
        '',
        'ทำตามลำดับ (ใช้ tools ของ series-studio ทุกขั้น ห้ามข้าม):',
        `1. เลือกสไตล์ 1 แบบ${style_id ? ` (ผู้ใช้เลือก ${style_id})` : ` จาก list_styles — มี: ${styles}`} และยืนยันอัตราส่วน${aspect ? ` ${aspect}` : ''} จำนวนตอน${episodes ? ` ${episodes}` : ''} ความยาวต่อตอน${ep_length_sec ? ` ${ep_length_sec} วินาที` : ''} กับผู้ใช้สั้นๆ ถ้ายังไม่ครบ`,
        '2. create_series (ตั้ง id เป็นภาษาอังกฤษ)',
        '3. write_bible: story.md (logline, ธีม, arc ซีซัน, สรุปทุกตอน), ตัวละคร 2–5 ตัว (look ต้องบรรยายรูปลักษณ์ชัดและคงที่ ห้ามอ้างคนจริง/ดารา), ฉาก 2–4 แห่ง (ระบุ light_sources และ axis_notes), ของสำคัญ, speech ของแต่ละตัวละคร',
        '4. write_outline ทุกตอน: จังหวะแรก hook (ดึงใน 3 วินาที), กลาง 4–6 จังหวะ (setup/conflict/mystery/twist), จบ cliffhanger เสมอ, ใส่ est_sec ให้รวมเท่าความยาวตอน',
        '5. get_series เพื่อตรวจว่า G1 พร้อม แล้วสรุปเรื่องให้ผู้ใช้อ่าน (สั้น กระชับ ภาษาไทย) และถามว่าอนุมัติ G1 หรือไม่ — เรียก approve_gate G1 เฉพาะเมื่อผู้ใช้ตอบว่าอนุมัติ',
        '',
        'กฎ: 1 ซีรีส์ = 1 สไตล์, ทุกช็อต/ทุกภาพอ้างอิงใช้สไตล์เดียวกัน, ห้ามชื่อคนจริง/ตัวละครหรือสตูดิโอที่มีลิขสิทธิ์ในทุกข้อความ',
      ].join('\n');
      return { messages: [{ role: 'user', content: { type: 'text', text } }] };
    },
  );

  server.registerPrompt(
    'breakdown_episode',
    {
      title: 'แตกตอนเป็นบท/ช็อต/prompt (Stage C–E)',
      description: 'Guide Claude through script -> shot list -> prompts for one episode of an approved series.',
      argsSchema: {
        series_id: z.string().min(1).describe('series id'),
        episode: z.string().min(1).describe('episode number'),
      },
    },
    ({ series_id, episode }) => {
      const text = [
        `แตกตอนที่ ${episode} ของซีรีส์ ${series_id} ตาม Look Bible ของ preset (อ่าน resource series://${series_id}/bible และ series://${series_id}/ep/${episode}/outline ก่อน)`,
        '',
        '1. write_script: บทพูดไทยแบบภาษาพูด ใช้สรรพนาม/คำลงท้ายตาม character.speech ทุกบรรทัดสั้น (≤ 6 วิ) ดูคำเตือนเรื่องเวลา',
        '2. write_shots: แตกช็อตให้ครบทุกจังหวะของ outline — ช็อตแรก beat hook ช็อตสุดท้าย beat cliffhanger, ทุกช็อตมี purpose, ใช้เลนส์/การเคลื่อนกล้องจาก camera ของ preset, ' +
          'ความยาวช็อตเฉลี่ยตาม pacing.avg_shot_sec, ห้ามเกิน maxClipSec ของ engine, เปลี่ยนฝั่งแกน 180° ต้องมี INSERT คั่นหรือใส่ axis_cross_reason, ' +
          'ใส่ dialogue พร้อม t_start/t_end ภายในช็อต, เวลารวมเท่าความยาวตอน ±5%',
        '3. ถ้า validator รายงาน error ให้แก้แล้วส่งใหม่ทั้งชุด (tool ไม่บันทึกถ้ามี error)',
        '4. compile_prompts แล้ว generate (draft) → ถ้า engine เป็น manual ให้ export_prompt_sheet แล้วบอกผู้ใช้ว่าต้องเจนอะไรใน Flow บ้าง',
        '5. เมื่อผู้ใช้เอาคลิปมาแล้ว import_clips → run_qc → รายงานช็อตที่พัง → regen_shot ที่จำเป็น → ขอ G3',
      ].join('\n');
      return { messages: [{ role: 'user', content: { type: 'text', text } }] };
    },
  );
}

