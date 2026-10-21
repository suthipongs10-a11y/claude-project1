import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createContext, type ContextOptions, type StudioContext } from './context.js';
import { registerStyleTools } from './tools/styles.js';
import { registerSeriesTools } from './tools/series.js';
import { registerBibleTools } from './tools/bible.js';
import { registerOutlineTools } from './tools/outline.js';
import { registerGateTools } from './tools/gates.js';
import { registerEpisodeTools } from './tools/episode.js';
import { registerQcTools } from './tools/qc.js';
import { registerResources } from './resources.js';
import { registerPrompts } from './prompts.js';

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
  registerSeriesTools(server, ctx);
  registerBibleTools(server, ctx);
  registerOutlineTools(server, ctx);
  registerGateTools(server, ctx);
  registerEpisodeTools(server, ctx);
  registerQcTools(server, ctx);
  registerResources(server, ctx);
  registerPrompts(server, ctx);
  return server;
}

export function createStudio(opts: ContextOptions = {}): { ctx: StudioContext; server: McpServer } {
  const ctx = createContext(opts);
  const server = buildServer(ctx);
  return { ctx, server };
}
