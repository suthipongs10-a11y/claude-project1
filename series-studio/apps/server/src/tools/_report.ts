import type { ValidationReport } from '@series-studio/core';

export function reportText(r: ValidationReport): string {
  const lines: string[] = [];
  if (r.errors.length) lines.push(`ข้อผิดพลาด ${r.errors.length} ข้อ:`, ...r.errors.map((e) => `  ✗ ${e.at ? `[${e.at}] ` : ''}${e.message}`));
  if (r.warnings.length) lines.push(`คำเตือน ${r.warnings.length} ข้อ:`, ...r.warnings.map((w) => `  ! ${w.at ? `[${w.at}] ` : ''}${w.message}`));
  if (!lines.length) lines.push('ผ่านการตรวจ ไม่มีข้อผิดพลาดหรือคำเตือน');
  return lines.join('\n');
}
