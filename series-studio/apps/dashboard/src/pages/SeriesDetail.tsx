import { useState } from 'react';
import { api, fileUrl, type Bible, type SeriesSummary } from '../api';
import { useLiveVersion } from '../live';
import { ActionButton, Badge, ErrorBox, Modal, Section, Spinner, statusLabel, useFetch } from '../components/ui';

const COLUMNS: Array<{ key: string; label: string; statuses: string[] }> = [
  { key: 'plan', label: 'วางแผน/บท', statuses: ['planned', 'scripted', 'shots_ready', 'prompts_ready'] },
  { key: 'gen', label: 'เจน/QC', statuses: ['generating', 'qc'] },
  { key: 'draft', label: 'ดราฟต์ผ่าน', statuses: ['draft_approved', 'assembling'] },
  { key: 'final', label: 'เสร็จ', statuses: ['final_ready', 'exported'] },
];

/** Screens 2 + 3: bible board (lock buttons, refs) and the episode kanban, plus G1/G2 approval. */
export function SeriesDetail({ id, tab }: { id: string; tab?: string }) {
  const v = useLiveVersion();
  const sum = useFetch(() => api.get<SeriesSummary>(`/api/series/${id}`), [id, v]);
  const bible = useFetch(() => api.get<{ bible: Bible | null }>(`/api/series/${id}/bible`), [id, v]);
  const [view, setView] = useState<'episodes' | 'bible'>(tab === 'bible' ? 'bible' : 'episodes');
  const [blockers, setBlockers] = useState<string[] | null>(null);
  if (sum.error) return <ErrorBox error={sum.error} onRetry={sum.reload} />;
  if (!sum.data) return <Spinner />;
  const s = sum.data.series;
  const approve = async (gate: 'G1' | 'G2') => {
    try {
      await api.post(`/api/series/${id}/gates/${gate}`, {});
      sum.reload();
    } catch (e) {
      const body = (e as { body?: { blockers?: string[] } }).body;
      if (body?.blockers) setBlockers(body.blockers);
      throw e;
    }
  };
  return (
    <div>
      <a href="#/" className="text-xs text-zinc-400">
        ← ซีรีส์ทั้งหมด
      </a>
      <div className="mb-3 mt-1 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">{s.title}</h1>
          <div className="text-xs text-zinc-400">
            {s.style_id} · {s.aspect} · {s.episodes} ตอน × {s.ep_length_sec}s · {statusLabel(s.status)}
          </div>
        </div>
      </div>
      <div className="card mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={s.gates.G1.approved ? 'ok' : 'warn'}>G1 เรื่อง {s.gates.G1.approved ? '✓' : 'รออนุมัติ'}</Badge>
        <Badge tone={s.gates.G2.approved ? 'ok' : 'warn'}>G2 asset {s.gates.G2.approved ? '✓' : 'รออนุมัติ'}</Badge>
        <span className="flex-1" />
        {!s.gates.G1.approved && (
          <ActionButton onClick={() => approve('G1')} confirm="ยืนยันอนุมัติเรื่อง (G1)? หลังจากนี้จะเริ่มเจนภาพอ้างอิง">
            อนุมัติ G1
          </ActionButton>
        )}
        {s.gates.G1.approved && !s.gates.G2.approved && (
          <ActionButton onClick={() => approve('G2')} confirm="ยืนยันอนุมัติและล็อก asset ทั้งหมด (G2)?">
            อนุมัติ G2
          </ActionButton>
        )}
        {sum.data.next_gate_check && !sum.data.next_gate_check.ok && (
          <button className="text-xs text-amber-300 underline" onClick={() => setBlockers(sum.data!.next_gate_check!.blockers)}>
            ยังอนุมัติ {sum.data.next_gate} ไม่ได้ ({sum.data.next_gate_check.blockers.length} ข้อ)
          </button>
        )}
      </div>
      {blockers && (
        <Modal title="สิ่งที่ต้องแก้ก่อนอนุมัติ" onClose={() => setBlockers(null)}>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-200">
            {blockers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </Modal>
      )}
      <div className="mb-3 flex gap-2">
        <button className={view === 'episodes' ? 'btn-primary' : 'btn-ghost'} onClick={() => setView('episodes')}>
          ตอน
        </button>
        <button className={view === 'bible' ? 'btn-primary' : 'btn-ghost'} onClick={() => setView('bible')}>
          Bible
        </button>
      </div>
      {view === 'episodes' && (
        <div className="grid gap-3 md:grid-cols-4">
          {COLUMNS.map((col) => {
            const eps = sum.data!.episodes.filter((e) => col.statuses.includes(e.status));
            return (
              <div key={col.key} className="rounded-2xl bg-zinc-900/60 p-2">
                <div className="mb-2 px-1 text-xs font-semibold text-zinc-400">
                  {col.label} <span className="text-zinc-600">({eps.length})</span>
                </div>
                <div className="space-y-2">
                  {eps.map((e) => (
                    <a key={e.episode} href={`#/s/${id}/ep/${e.episode}`} className="card block hover:border-zinc-600">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">ตอน {e.episode}</div>
                        <Badge tone="muted">{statusLabel(e.status)}</Badge>
                      </div>
                      <div className="truncate text-xs text-zinc-400">{e.title ?? '(ยังไม่มีชื่อ)'}</div>
                      <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                        <Badge tone={e.has_outline ? 'ok' : 'muted'}>outline</Badge>
                        <Badge tone={e.has_script ? 'ok' : 'muted'}>บท</Badge>
                        <Badge tone={e.shots ? 'ok' : 'muted'}>{e.shots} ช็อต</Badge>
                        {e.qc.pass + e.qc.fail > 0 ? (
                          <Badge tone={e.qc.fail ? 'bad' : 'ok'}>
                            QC ✓{e.qc.pass} ✗{e.qc.fail}
                          </Badge>
                        ) : null}
                        {e.gates.G3.approved && <Badge tone="ok">G3</Badge>}
                        {e.gates.G4.approved && <Badge tone="ok">G4</Badge>}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {view === 'bible' && (
        <div>
          {bible.error ? <ErrorBox error={bible.error} onRetry={bible.reload} /> : null}
          {bible.data && !bible.data.bible && <div className="card text-sm text-zinc-400">ยังไม่มี bible — ให้ Claude เขียนด้วย write_bible</div>}
          {bible.data?.bible && (
            <>
              <EntityBoard id={id} type="character" title="ตัวละคร" items={bible.data.bible.characters.map((c) => ({ ...c, sub: `${c.role} · ${c.look}` }))} onChange={() => (bible.reload(), sum.reload())} />
              <EntityBoard id={id} type="location" title="ฉาก" items={bible.data.bible.locations.map((l) => ({ ...l, sub: l.look ?? l.time_variants.join(', ') }))} onChange={() => (bible.reload(), sum.reload())} />
              <EntityBoard id={id} type="prop" title="ของสำคัญ" items={bible.data.bible.props.map((p) => ({ ...p, sub: `${p.is_product ? 'สินค้า · ' : ''}${p.look}` }))} onChange={() => (bible.reload(), sum.reload())} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function EntityBoard({ id, type, title, items, onChange }: { id: string; type: 'character' | 'location' | 'prop'; title: string; items: Array<{ id: string; name: string; sub: string; refs: string[]; locked: boolean; ref_version: number }>; onChange: () => void }) {
  return (
    <Section title={`${title} (${items.length})`}>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((e) => (
          <div key={e.id} className="card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">
                  {e.name} <span className="text-xs text-zinc-500">{e.id}</span>
                </div>
                <div className="line-clamp-2 text-xs text-zinc-400">{e.sub}</div>
              </div>
              <Badge tone={e.locked ? 'ok' : 'warn'}>{e.locked ? `🔒 v${e.ref_version}` : 'ยังไม่ล็อก'}</Badge>
            </div>
            <div className="mt-2 flex gap-1 overflow-x-auto">
              {e.refs.length === 0 && <div className="text-xs text-zinc-500">ยังไม่มีภาพอ้างอิง (gen_reference → import_refs)</div>}
              {e.refs.map((r) => (
                <a key={r} href={fileUrl(id, r)} target="_blank" rel="noreferrer">
                  <img src={fileUrl(id, r)} alt={r} className="h-24 w-20 flex-none rounded-lg object-cover bg-zinc-800" loading="lazy" />
                </a>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              {!e.locked ? (
                <ActionButton className="btn-primary" onClick={() => api.post(`/api/series/${id}/assets/${type}/${e.id}/lock`).then(onChange)} confirm={e.refs.length ? undefined : 'ยังไม่มีภาพอ้างอิง ล็อกไม่ได้'}>
                  ล็อก
                </ActionButton>
              ) : (
                <ActionButton className="btn-ghost" onClick={() => api.post(`/api/series/${id}/assets/${type}/${e.id}/unlock`).then(onChange)} confirm="ปลดล็อกจะเปิดเวอร์ชันภาพอ้างอิงใหม่ (ของเดิมยังอยู่) ยืนยัน?">
                  ปลดล็อก
                </ActionButton>
              )}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
