import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createContext, type ContextOptions, type StudioContext } from './context.js';
import { registerStyleTools } from './tools/styles.js';

export const SERVER_NAME = 'series-studio';
export const SERVER_VERSION = '0.1.0';

/** Build an MCP server with every tool registered. Transport is attached by the caller. */
export function buildServer(ctx: StudioContext): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        'Series Studio: Claude is the director. Work milestone by milestone: plan series (G1) -> lock assets (G2) -> ' +
        'per episode script/shots/prompts/generate/QC (G3) -> assemble/export (G4). User-facing text is Thai.',
    },
  );
  registerStyleTools(server, ctx);
  return server;
}

export function createStudio(opts: ContextOptions = {}): { ctx: StudioContext; server: McpServer } {
  const ctx = createContext(opts);
  const server = buildServer(ctx);
  return { ctx, server };
}
