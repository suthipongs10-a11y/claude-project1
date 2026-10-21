/** Finish the demo episode: final assembly as a background task (polled), G4, continuity, cost. */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const SID = process.env['DEMO_SERIES_ID'] ?? 'cafe-secret';
const EP = Number(process.env['DEMO_EPISODE'] ?? 1);

async function main() {
  const transport = new StdioClientTransport({ command: process.execPath, args: [join(root, 'apps/server/dist/mcp.js')], env: { ...process.env, SERIES_STUDIO_NO_HTTP: '1', NODE_USE_ENV_PROXY: '1' }, stderr: 'inherit' });
  const client = new Client({ name: 'demo-finish', version: '0.1.0' });
  await client.connect(transport);
  const call = async (name: string, args: Record<string, unknown>, allowError = false) => {
    const res = await client.callTool({ name, arguments: args });
    const text = (res.content as Array<{ type: string; text?: string }>).map((c) => c.text ?? '').join('\n');
    console.log(`${res.isError ? '✗' : '✓'} ${name}: ${(text.split('\n')[0] ?? '').slice(0, 170)}`);
    if (res.isError && !allowError) throw new Error(text);
    return { text, data: (res.structuredContent ?? {}) as Record<string, unknown> };
  };
  const started = Date.now();
  let r = await call('assemble', { series_id: SID, episode: EP, quality: 'final', wait_sec: 10 });
  while (r.data['task_status'] === 'running') {
    r = await call('task_status', { task_id: r.data['task_id'], wait_sec: 50 });
  }
  console.log(r.text);
  console.log(`assembly wall time ${Math.round((Date.now() - started) / 1000)}s`);
  await call('approve_gate', { series_id: SID, gate: 'G4', episode: EP }, true);
  await call('update_continuity', { series_id: SID, episode: EP, states: { mina: { holding: 'the letter', state: 'รู้แล้วว่าตั้นคือคนนั้น' } } });
  console.log((await call('cost_report', { series_id: SID })).text);
  console.log((await call('get_series', { series_id: SID })).text);
  await client.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
