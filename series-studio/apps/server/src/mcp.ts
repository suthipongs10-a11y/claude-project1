#!/usr/bin/env node
/**
 * MCP stdio entry point. Register in claude_desktop_config.json as:
 *   { "mcpServers": { "series-studio": { "command": "node", "args": ["apps/server/dist/mcp.js"] } } }
 * stdout is reserved for the protocol; logs go to logs/server.jsonl (and stderr with SERIES_STUDIO_LOG_STDERR=1).
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createStudio } from './server.js';
import { startHttpServer } from './http/server.js';

async function main(): Promise<void> {
  const { ctx, server } = createStudio();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  ctx.log.info('mcp_started', { presets: ctx.presets.size, projects_dir: ctx.config.projects_dir });
  let http: Awaited<ReturnType<typeof startHttpServer>> | undefined;
  if (ctx.config.http.enabled && process.env['SERIES_STUDIO_NO_HTTP'] !== '1') {
    try {
      http = await startHttpServer(ctx);
      process.stderr.write(`series-studio dashboard: ${http.url}\n`);
    } catch (e) {
      // another server instance may already own the port; MCP keeps working without the dashboard
      ctx.log.warn('http_start_failed', { error: (e as Error).message });
      process.stderr.write(`series-studio: เปิด HTTP server ไม่ได้ (${(e as Error).message}) — MCP ยังใช้งานได้\n`);
    }
  }
  const shutdown = async () => {
    ctx.log.info('mcp_stopping');
    await http?.app.close().catch(() => undefined);
    await server.close().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  process.stderr.write(`series-studio MCP server ล้มเหลว: ${(e as Error).stack ?? String(e)}\n`);
  process.exit(1);
});
