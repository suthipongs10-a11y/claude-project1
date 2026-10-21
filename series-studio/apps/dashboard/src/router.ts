import { useEffect, useState } from 'react';

/** Hash router: #/ | #/new | #/s/:id | #/s/:id/ep/:n | #/queue | #/settings */
export type Route =
  | { name: 'series' }
  | { name: 'new' }
  | { name: 'detail'; id: string; tab?: string }
  | { name: 'episode'; id: string; n: number; tab?: string }
  | { name: 'queue' }
  | { name: 'settings' };

export function parseRoute(hash: string): Route {
  const [path, query] = hash.replace(/^#/, '').split('?');
  const parts = (path ?? '/').split('/').filter(Boolean);
  const tab = new URLSearchParams(query ?? '').get('tab') ?? undefined;
  if (parts.length === 0) return { name: 'series' };
  if (parts[0] === 'new') return { name: 'new' };
  if (parts[0] === 'queue') return { name: 'queue' };
  if (parts[0] === 'settings') return { name: 'settings' };
  if (parts[0] === 's' && parts[1]) {
    if (parts[2] === 'ep' && parts[3]) return { name: 'episode', id: parts[1], n: Number(parts[3]), ...(tab ? { tab } : {}) };
    return { name: 'detail', id: parts[1], ...(tab ? { tab } : {}) };
  }
  return { name: 'series' };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const h = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return route;
}

export function go(hash: string): void {
  window.location.hash = hash;
}
