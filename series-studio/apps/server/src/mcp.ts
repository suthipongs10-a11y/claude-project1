#!/usr/bin/env node
/**
 * MCP stdio entry point. Register in claude_desktop_config.json as:
 *   { "mcpServers": { "series-studio": { "command": "node", "args": ["apps/server/dist/mcp.js"] } } }
 * stdout is reserved for the protocol; logs go to logs/server.jsonl (and stderr with SERIES_STUDIO_LOG_STDERR=1).
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createStudio } from './server.js';

async function main(): Promise<void> {
  const { ctx, server } = createStudio();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  ctx.log.info('mcp_started', { presets: ctx.presets.size, projects_dir: ctx.config.projects_dir });
  const shutdown = async () => {
    ctx.log.info('mcp_stopping');
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
