import { afterEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from '../src/server.js';
import { makeTempStudio } from './helpers.js';

async function connect() {
  const t = makeTempStudio();
  const server = buildServer(t.ctx);
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await server.connect(serverT);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientT);
  return { t, client, server, close: async () => { await client.close(); await server.close(); t.cleanup(); } };
}

describe('MCP server (in-memory transport)', () => {
  const closers: Array<() => Promise<void>> = [];
  afterEach(async () => { for (const c of closers.splice(0)) await c(); });

  it('exposes list_styles', async () => {
    const c = await connect();
    closers.push(c.close);
    const tools = await c.client.listTools();
    expect(tools.tools.map((t) => t.name)).toContain('list_styles');
  });

  it('list_styles returns presets from disk and full detail by id', async () => {
    const c = await connect();
    closers.push(c.close);
    const res = await c.client.callTool({ name: 'list_styles', arguments: {} });
    expect(res.isError).toBeFalsy();
    const sc = res.structuredContent as { count: number; styles: Array<{ id: string }> };
    expect(sc.count).toBeGreaterThan(0);
    expect(sc.styles.map((s) => s.id)).toContain('live_kdrama_dub');

    const one = await c.client.callTool({ name: 'list_styles', arguments: { id: 'live_kdrama_dub' } });
    const preset = (one.structuredContent as { preset: { id: string; dialogue_mode: string } }).preset;
    expect(preset.dialogue_mode).toBe('dub');

    const bad = await c.client.callTool({ name: 'list_styles', arguments: { id: 'nope' } });
    expect(bad.isError).toBe(true);
    expect((bad.content as Array<{ text: string }>)[0]?.text).toContain('ไม่พบสไตล์');
  });
});
