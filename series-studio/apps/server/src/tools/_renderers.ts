import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { AssembleResult } from '../services/assembly.js';
import type { QcRunSummary } from '../services/qc.js';
import type { DubResult } from '../services/voice.js';
import { ok } from './_helpers.js';

/** Result renderers shared by the tools and task_status (one per long-running task kind). */
export function renderAssemble(res: AssembleResult, episode: number, quality: string): CallToolResult {
  const tl = res.timeline;
  const text =
    `ประกอบตอนที่ ${episode} (${quality}, ${tl.aspect} ${tl.width}x${tl.height}, ${tl.total_sec}s, ${tl.subtitles.length} ซับ, เสียง: ${tl.audio.source}) แล้ว\n` +
    `- วิดีโอ: ${tl.outputs.video}\n` +
    (tl.outputs.srt ? `- ซับ: ${tl.outputs.srt}\n` : '') +
    (tl.outputs.cover ? `- ปก: ${tl.outputs.cover}\n` : '') +
    `- ความดังก่อนปรับ ${tl.audio.measured?.['input_i']?.toFixed(1)} LUFS → เป้า ${tl.audio.loudness_lufs} LUFS\n` +
    (res.warnings.length ? `คำเตือน:\n- ${res.warnings.join('\n- ')}\n` : '') +
    (quality === 'final' ? 'ขั้นต่อไป: ให้ผู้ใช้ดูไฟล์แล้ว approve_gate G4' : 'ดูตัวอย่างแล้วถ้าโอเค approve_gate G3 → assemble quality final');
  return ok({ timeline: tl, video: res.video, srt: res.srt ?? null, cover: res.cover ?? null, warnings: res.warnings }, text);
}

export function renderQc(res: QcRunSummary, episode: number): CallToolResult {
  const lines = res.results.map((r) => `- ${r.shot_id} v${r.version}: ${r.pass ? '✅ ผ่าน' : `❌ ${r.reasons.join('; ')}`}${r.review ? ` (review: ${r.review.pass ? 'ผ่าน' : 'ไม่ผ่าน'} โดย ${r.review.by})` : ''}`);
  const text =
    `QC ตอนที่ ${episode}: ผ่าน ${res.summary.pass}/${res.summary.shots} ช็อต\n${lines.join('\n')}` +
    (res.skipped_checks.length ? `\nเช็กที่ข้าม (ไม่ได้ติดตั้ง/ไม่เกี่ยว): ${res.skipped_checks.join(', ')}` : '') +
    (res.errors.length ? `\nปัญหา: ${res.errors.join('; ')}` : '') +
    (res.regen?.length ? `\nเจนซ่อม: ${res.regen.map((g) => `${g.shot_id}→${g.job_id ?? `ข้าม (${g.skipped_reason})`}`).join(', ')}` : '') +
    (res.summary.fail ? '\nใช้ get_keyframes ดูภาพช็อตที่พัง แล้ว review_shot / regen_shot' : '\nทุกช็อตผ่าน → ขอผู้ใช้อนุมัติ G3');
  return ok({ summary: res.summary, results: res.results, skipped_checks: res.skipped_checks, errors: res.errors, regen: res.regen ?? [] }, text);
}

export function renderDub(res: DubResult, episode: number): CallToolResult {
  const speakers = [...new Set(res.cues.map((c) => c.speaker))];
  const text =
    `พากย์ตอนที่ ${episode} แล้ว (${res.provider}): ${res.cues.length} ประโยค จาก ${speakers.length} เสียง (${speakers.join(', ')}) ใช้แคช ${res.reused}\n` +
    `voice track: ${res.track} (${res.content_sec}s)\n` +
    (res.warnings.length ? `คำเตือน:\n- ${res.warnings.join('\n- ')}\n` : '') +
    'ขั้นต่อไป: assemble (จะใช้ voice track อัตโนมัติ)';
  return ok({ track: res.track, content_sec: res.content_sec, cues: res.cues, warnings: res.warnings, provider: res.provider }, text);
}

/** Task kind -> renderer of its stored result (results carry the episode/quality they were made with). */
export const renderers: Record<string, (result: unknown) => CallToolResult> = {
  assemble: (r) => {
    const x = r as AssembleResult & { episode: number; quality: string };
    return renderAssemble(x, x.episode, x.quality);
  },
  run_qc: (r) => {
    const x = r as QcRunSummary & { episode: number };
    return renderQc(x, x.episode);
  },
  dub_episode: (r) => {
    const x = r as DubResult & { episode: number };
    return renderDub(x, x.episode);
  },
};
