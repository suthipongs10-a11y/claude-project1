import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from '../src/server.js';
import { makeTempStudio } from './helpers.js';

export interface CallResult<T = Record<string, unknown>> {
  isError: boolean;
  text: string;
  data: T;
}

/** In-memory MCP client against a fresh temp studio; `call` returns text + structuredContent. */
export async function studioClient() {
  const t = makeTempStudio();
  const server = buildServer(t.ctx);
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await server.connect(serverT);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientT);
  const call = async <T = Record<string, unknown>>(name: string, args: Record<string, unknown> = {}): Promise<CallResult<T>> => {
    const res = await client.callTool({ name, arguments: args });
    const text = (res.content as Array<{ type: string; text?: string }>).map((c) => c.text ?? '').join('\n');
    return { isError: res.isError === true, text, data: (res.structuredContent ?? {}) as T };
  };
  const close = async () => {
    await client.close();
    await server.close();
    t.cleanup();
  };
  return { t, client, call, close };
}
