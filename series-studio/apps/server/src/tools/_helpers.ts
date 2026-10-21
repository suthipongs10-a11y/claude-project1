import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Logger } from '../util/log.js';

/** Successful tool result: human-readable JSON text plus structuredContent. */
export function ok(data: Record<string, unknown>, text?: string): CallToolResult {
  return {
    content: [{ type: 'text', text: text ?? JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

/** Error result with a Thai message for the user. */
export function fail(message: string, extra?: Record<string, unknown>): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
    ...(extra ? { structuredContent: { error: message, ...extra } } : { structuredContent: { error: message } }),
  };
}

/** Wrap a tool handler so thrown errors become Thai error results and get logged. */
export function guarded<A>(
  log: Logger,
  toolName: string,
  fn: (args: A) => Promise<CallToolResult> | CallToolResult,
): (args: A) => Promise<CallToolResult> {
  return async (args: A) => {
    const started = Date.now();
    try {
      const res = await fn(args);
      log.info('tool_call', { tool: toolName, ms: Date.now() - started, isError: res.isError === true });
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.error('tool_error', { tool: toolName, ms: Date.now() - started, error: msg });
      return fail(`เครื่องมือ ${toolName} ทำงานไม่สำเร็จ: ${msg}`);
    }
  };
}
