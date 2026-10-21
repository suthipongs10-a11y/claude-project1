/** A validation issue reported to the user (message in Thai). */
export interface Issue {
  level: 'error' | 'warning';
  code: string;
  message: string;
  /** Where the issue is (shot id, character id, json path...). */
  at?: string;
}

export interface ValidationReport {
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
}

export function makeReport(issues: Issue[]): ValidationReport {
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  return { ok: errors.length === 0, errors, warnings };
}

export function error(code: string, message: string, at?: string): Issue {
  return at === undefined ? { level: 'error', code, message } : { level: 'error', code, message, at };
}

export function warning(code: string, message: string, at?: string): Issue {
  return at === undefined ? { level: 'warning', code, message } : { level: 'warning', code, message, at };
}
