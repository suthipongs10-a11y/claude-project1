import { z } from 'zod';

/** Render zod issues as short Thai-friendly lines: "path: message". */
export function formatZodError(err: z.ZodError): string[] {
  return err.issues.map((i) => {
    const path = i.path.length ? i.path.map(String).join('.') : '(root)';
    return `${path}: ${i.message}`;
  });
}

export class SchemaError extends Error {
  readonly lines: string[];
  constructor(what: string, err: z.ZodError) {
    const lines = formatZodError(err);
    super(`ข้อมูล ${what} ไม่ผ่าน schema:\n- ${lines.join('\n- ')}`);
    this.name = 'SchemaError';
    this.lines = lines;
  }
}

/** Parse or throw a SchemaError whose message is user-facing (Thai). */
export function parseOrThrow<T extends z.ZodType>(schema: T, data: unknown, what: string): z.output<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw new SchemaError(what, r.error);
  return r.data;
}
