import { useLiveStatus } from '../live';
import type { Route } from '../router';

const items: Array<{ hash: string; label: string; icon: string; match: (r: Route) => boolean }> = [
  { hash: '#/', label: 'ซีรีส์', icon: '🎬', match: (r) => r.name === 'series' || r.name === 'new' || r.name === 'detail' || r.name === 'episode' },
  { hash: '#/queue', label: 'คิว/เครดิต', icon: '📋', match: (r) => r.name === 'queue' },
  { hash: '#/settings', label: 'ตั้งค่า', icon: '⚙️', match: (r) => r.name === 'settings' },
];

export function Nav({ route }: { route: Route }) {
  const live = useLiveStatus();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur" style={{ paddingBottom: 'var(--safe-bottom)' }}>
      <div className="mx-auto flex max-w-3xl items-stretch">
        {items.map((it) => (
          <a key={it.hash} href={it.hash} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${it.match(route) ? 'text-amber-300' : 'text-zinc-400'}`}>
            <span className="text-lg leading-none">{it.icon}</span>
            {it.label}
          </a>
        ))}
        <div className="flex items-center px-3 text-[10px] text-zinc-500" title="สถานะการเชื่อมต่อ server">
          <span className={`mr-1 inline-block h-2 w-2 rounded-full ${live === 'online' ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
          {live === 'online' ? 'live' : 'offline'}
        </div>
      </div>
    </nav>
  );
}
