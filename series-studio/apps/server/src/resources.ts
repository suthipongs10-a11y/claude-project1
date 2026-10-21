import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Continuity, ShotList, Script } from '@series-studio/core';
import { join } from 'node:path';
import type { StudioContext } from './context.js';
import { SeriesService } from './services/series.js';

/**
 * MCP resources (SPEC §9): let Claude read series context without pasting it into chat.
 *   series://<id>/series   series.json
 *   series://<id>/bible    story + characters + locations + props + voices
 *   series://<id>/ep/<n>/outline | script | shots
 */
export function registerResources(server: McpServer, ctx: StudioContext): void {
  const svc = new SeriesService(ctx);
  const json = (uri: URL, data: unknown) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }] });
  const listSeries = () => ({
    resources: ctx.store.listSeriesIds().flatMap((id) => [
      { uri: `series://${id}/series`, name: `${id} series.json`, mimeType: 'application/json' },
      { uri: `series://${id}/bible`, name: `${id} bible`, mimeType: 'application/json' },
    ]),
  });

  server.registerResource(
    'series',
    new ResourceTemplate('series://{id}/series', { list: listSeries }),
    { title: 'series.json', description: 'Series metadata, style, gates' },
    (uri, { id }) => json(uri, svc.load(String(id))),
  );

  server.registerResource(
    'bible',
    new ResourceTemplate('series://{id}/bible', { list: undefined }),
    { title: 'Series Bible', description: 'story.md + characters + locations + props + voices' },
    (uri, { id }) => {
      const bible = svc.loadBible(String(id));
      if (!bible) throw new Error(`ซีรีส์ "${String(id)}" ยังไม่มี bible`);
      return json(uri, bible);
    },
  );

  server.registerResource(
    'continuity',
    new ResourceTemplate('series://{id}/continuity', { list: undefined }),
    { title: 'Continuity', description: 'character state after each episode' },
    (uri, { id }) => {
      svc.load(String(id));
      return json(uri, ctx.store.readJsonIfExists(join(ctx.store.seriesDir(String(id)), 'continuity.json'), Continuity, 'continuity.json') ?? Continuity.parse({}));
    },
  );

  server.registerResource(
    'episode-file',
    new ResourceTemplate('series://{id}/ep/{n}/{kind}', {
      list: undefined,
      complete: { kind: () => ['outline', 'script', 'shots'] },
    }),
    { title: 'Episode file', description: 'outline | script | shots of one episode' },
    (uri, { id, n, kind }) => {
      const seriesId = String(id);
      const ep = Number(n);
      const series = svc.load(seriesId);
      svc.requireEpisode(series, ep);
      switch (String(kind)) {
        case 'outline': {
          const o = svc.loadOutline(seriesId, ep);
          if (!o) throw new Error(`ตอนที่ ${ep} ยังไม่มี outline`);
          return json(uri, o);
        }
        case 'script':
          return json(uri, ctx.store.readJson(ctx.store.episodePath(seriesId, ep, 'script.json'), Script, 'script.json'));
        case 'shots':
          return json(uri, ctx.store.readJson(ctx.store.episodePath(seriesId, ep, 'shots.json'), ShotList, 'shots.json'));
        default:
          throw new Error(`ไม่รู้จัก resource "${String(kind)}" (ใช้ outline | script | shots)`);
      }
    },
  );
}
