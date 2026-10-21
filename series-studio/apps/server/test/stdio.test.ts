import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { makeTempStudio, REPO_STUDIO_ROOT } from './helpers.js';

/**
 * Acceptance for M0: a real client process can start `node apps/server/dist/mcp.js` over stdio,
 * list tools and call list_styles (what Claude Desktop does).
 */
describe('MCP over stdio (built server)', () => {
  it('starts dist/mcp.js and calls list_styles', async () => {
    const entry = join(REPO_STUDIO_ROOT, 'apps', 'server', 'dist', 'mcp.js');
    if (!existsSync(entry)) execSync('pnpm build', { cwd: REPO_STUDIO_ROOT, stdio: 'ignore' });
    const t = makeTempStudio();
    try {
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [entry],
        env: { ...process.env, SERIES_STUDIO_HOME: t.root, SERIES_STUDIO_NO_HTTP: '1' },
        stderr: 'pipe',
      });
      const client = new Client({ name: 'stdio-test', version: '0.0.0' });
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools.map((x) => x.name)).toContain('list_styles');
      const res = await client.callTool({ name: 'list_styles', arguments: {} });
      expect(res.isError).toBeFalsy();
      expect((res.structuredContent as { count: number }).count).toBeGreaterThan(0);
      await client.close();
      expect(existsSync(join(t.root, 'logs', 'server.jsonl'))).toBe(true);
    } finally {
      t.cleanup();
    }
  }, 60_000);
});
