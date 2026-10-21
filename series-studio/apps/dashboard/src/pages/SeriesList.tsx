import { api, type SeriesRow } from '../api';
import { useLiveVersion } from '../live';
import { Badge, ErrorBox, Spinner, statusLabel, useFetch } from '../components/ui';

export function SeriesList() {
  const v = useLiveVersion();
  const { data, error, reload } = useFetch(() => api.get<{ series: SeriesRow[] }>('/api/series'), [v]);
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">ซีรีส์ของฉัน</h1>
        <a href="#/new" className="btn-primary">
          + สร้างใหม่
        </a>
      </div>
      {error ? <ErrorBox error={error} onRetry={reload} /> : null}
      {!data && !error && <Spinner />}
      {data && data.series.length === 0 && <div className="card text-sm text-zinc-400">ยังไม่มีซีรีส์ กด “สร้างใหม่” หรือสั่ง Claude ผ่าน plan_series</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        {data?.series.map((s) => (
          <a key={s.id} href={`#/s/${s.id}`} className="card block hover:border-zinc-600">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{s.title}</div>
                <div className="text-xs text-zinc-400">
                  {s.style_id} · {s.aspect} · {s.episodes} ตอน × {s.ep_length_sec}s
                </div>
              </div>
              <Badge tone={s.status === 'production' ? 'info' : s.status === 'planning' ? 'muted' : 'ok'}>{statusLabel(s.status)}</Badge>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-zinc-300">{s.logline}</p>
            <div className="mt-2 flex gap-2 text-xs">
              <Badge tone={s.gates.G1.approved ? 'ok' : 'muted'}>G1 {s.gates.G1.approved ? '✓' : '…'}</Badge>
              <Badge tone={s.gates.G2.approved ? 'ok' : 'muted'}>G2 {s.gates.G2.approved ? '✓' : '…'}</Badge>
              {s.product && <Badge tone="warn">สินค้า: {s.product.name}</Badge>}
              {s.cost && s.cost.total_credits > 0 && <Badge tone="muted">{s.cost.total_credits} เครดิต</Badge>}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
