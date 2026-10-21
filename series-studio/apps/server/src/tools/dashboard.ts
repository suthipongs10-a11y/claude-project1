import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { StudioContext } from '../context.js';
import { loadOrCreateToken } from '../http/token.js';
import { guarded, ok } from './_helpers.js';

export function registerDashboardTools(server: McpServer, ctx: StudioContext): void {
  server.registerTool(
    'dashboard_info',
    {
      title: 'ลิงก์ Dashboard',
      description: 'Return the local dashboard URL with its pairing token (server binds 127.0.0.1 only; use a tunnel such as Tailscale or ssh -L to reach it from a phone).',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    guarded(ctx.log, 'dashboard_info', () => {
      const token = loadOrCreateToken(ctx.config.data_dir);
      const { host, port, enabled } = ctx.config.http;
      const url = `http://${host}:${port}/?token=${token}`;
      return ok(
        { url, host, port, enabled, token },
        enabled
          ? `Dashboard: ${url}\nเปิดบนเครื่องที่รัน server ได้เลย ถ้าจะใช้บนมือถือให้ทำ tunnel (เช่น Tailscale serve หรือ ssh -L ${port}:127.0.0.1:${port}) แล้วเปิดลิงก์เดียวกัน token นี้ใช้จับคู่ Chrome Extension ด้วย`
          : 'HTTP server ถูกปิดใน config (http.enabled = false)',
      );
    }),
  );
}
