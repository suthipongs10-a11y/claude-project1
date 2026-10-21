import { api, type Job, type SeriesRow } from '../api';
import { useLiveVersion } from '../live';
import { ActionButton, Badge, ErrorBox, Section, Spinner, statusLabel, useFetch } from '../components/ui';

/** Screen 6: pending jobs and credits per series/episode. */
export function QueueCost() {
  const v = useLiveVersion();
  const jobs = useFetch(() => api.get<{ jobs: Job[] }>('/api/jobs'), [v]);
  const series = useFetch(() => api.get<{ series: Array<SeriesRow & { cost: { total_credits: number; episodes: Record<string, { credits: number; jobs: number }> } | null }> }>('/api/series'), [v]);
  const ext = useFetch(() => api.get<{ connected: boolean; version?: string; active_job: string | null; halted: string | null; queued: number }>('/api/ext/status'), [v]);
  if (jobs.error) return <ErrorBox error={jobs.error} onRetry={jobs.reload} />;
  if (!jobs.data || !series.data) return <Spinner />;
  const open = jobs.data.jobs.filter((j) => !['done', 'cancelled'].includes(j.status));
  const tone = (s: string) => (s === 'failed' ? 'bad' : s === 'done' ? 'ok' : s === 'awaiting_import' ? 'warn' : 'info');
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">คิวงาน & เครดิต</h1>
      {ext.data && (
        <Section title="Chrome Extension (Flow)">
          <div className="card flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={ext.data.connected ? 'ok' : 'muted'}>{ext.data.connected ? `เชื่อมต่อแล้ว v${ext.data.version ?? '?'}` : 'ยังไม่เชื่อมต่อ'}</Badge>
            <span className="text-xs text-zinc-400">งานที่ทำอยู่: {ext.data.active_job ?? '—'} · รอคิว flow_ext: {ext.data.queued}</span>
            {ext.data.halted && (
              <>
                <span className="w-full text-xs text-rose-300">⚠️ คิวหยุด: {ext.data.halted}</span>
                <ActionButton className="btn-primary" onClick={() => api.post('/api/ext/resume').then(() => (ext.reload(), jobs.reload()))}>
                  แก้แล้ว ทำต่อ (resume)
                </ActionButton>
              </>
            )}
          </div>
        </Section>
      )}
      <Section title={`งานค้าง (${open.length})`}>
        {open.length === 0 && <div className="card text-sm text-zinc-400">ไม่มีงานค้าง</div>}
        <div className="space-y-2">
          {open.map((j) => (
            <div key={j.id} className="card flex items-center gap-2 text-sm">
              <Badge tone={tone(j.status)}>{statusLabel(j.status)}</Badge>
              <div className="flex-1">
                <div className="font-mono text-xs">{j.id}</div>
                <div className="text-xs text-zinc-400">
                  {j.kind === 'clip' ? `ตอน ${j.episode} · ${j.batch_id} · ครั้งที่ ${j.attempt} · ${j.quality}` : `ref · ${j.entity_id}`}
                  {j.fix_notes ? ` · fix: ${j.fix_notes}` : ''}
                </div>
              </div>
              <div className="text-xs text-zinc-500">{j.cost_credits} cr</div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="เครดิตที่ใช้">
        <div className="space-y-2">
          {series.data.series.map((s) => (
            <div key={s.id} className="card text-sm">
              <div className="flex items-center justify-between">
                <a href={`#/s/${s.id}`} className="font-semibold">
                  {s.title}
                </a>
                <Badge tone="muted">{s.cost?.total_credits ?? 0} เครดิต</Badge>
              </div>
              <div className="mt-1 flex flex-wrap gap-1 text-xs text-zinc-400">
                {Object.entries(s.cost?.episodes ?? {}).map(([ep, c]) => (
                  <span key={ep} className="rounded bg-zinc-800 px-2 py-0.5">
                    ตอน {ep}: {c.credits} cr / {c.jobs} งาน
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Section title={`งานทั้งหมด (${jobs.data.jobs.length})`}>
        <div className="max-h-80 space-y-1 overflow-auto text-xs">
          {jobs.data.jobs
            .slice()
            .reverse()
            .map((j) => (
              <div key={j.id} className="flex items-center gap-2 border-b border-zinc-800 py-1">
                <Badge tone={tone(j.status)}>{statusLabel(j.status)}</Badge>
                <span className="font-mono">{j.id}</span>
                <span className="text-zinc-400">{j.kind === 'clip' ? `ep${j.episode} ${j.batch_id} #${j.attempt}` : `ref ${j.entity_id}`}</span>
                <span className="flex-1 truncate text-zinc-500">{j.output ?? ''}</span>
              </div>
            ))}
        </div>
      </Section>
    </div>
  );
}
