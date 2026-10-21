import { useRef, useState } from 'react';
import { api, epTag, fileUrl, type EpisodeDetail, type Shot } from '../api';
import { useLiveVersion } from '../live';
import { ActionButton, Badge, ErrorBox, Modal, Section, Spinner, statusLabel, useFetch } from '../components/ui';

/** Screens 4 + 5: shot grid (storyboard + QC badges + regen) and the review player with approvals. */
export function EpisodePage({ id, n, tab }: { id: string; n: number; tab?: string }) {
  const v = useLiveVersion();
  const { data, error, reload } = useFetch(() => api.get<EpisodeDetail>(`/api/series/${id}/episodes/${n}`), [id, n, v]);
  const tasks = useFetch(() => api.get<{ tasks: Array<{ id: string; label: string; status: string; progress?: string; error?: string }> }>(`/api/tasks?series_id=${id}&episode=${n}`), [id, n, v]);
  const [view, setView] = useState<'shots' | 'review'>(tab === 'review' ? 'review' : 'shots');
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Spinner />;
  return (
    <div>
      <a href={`#/s/${id}`} className="text-xs text-zinc-400">
        ← กลับไปที่ซีรีส์
      </a>
      <div className="mb-3 mt-1 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">
            ตอน {n} {data.outline?.title ? `· ${data.outline.title}` : ''}
          </h1>
          <div className="text-xs text-zinc-400">{statusLabel(data.state.status)}</div>
        </div>
        <div className="flex gap-1">
          <Badge tone={data.state.gates.G3.approved ? 'ok' : 'muted'}>G3</Badge>
          <Badge tone={data.state.gates.G4.approved ? 'ok' : 'muted'}>G4</Badge>
        </div>
      </div>
      {tasks.data?.tasks.filter((t) => t.status === 'running').map((t) => (
        <div key={t.id} className="card mb-3 border-amber-700 text-sm text-amber-200">
          ⏳ {t.label} กำลังทำอยู่{t.progress ? ` (${t.progress})` : ''} — หน้านี้จะอัปเดตเองเมื่อเสร็จ
        </div>
      ))}
      {tasks.data?.tasks.filter((t) => t.status === 'failed').slice(-1).map((t) => (
        <div key={t.id} className="card mb-3 border-rose-800 text-sm text-rose-200">
          ✗ {t.label} ล้มเหลว: {t.error}
        </div>
      ))}
      <div className="mb-3 flex gap-2">
        <button className={view === 'shots' ? 'btn-primary' : 'btn-ghost'} onClick={() => setView('shots')}>
          ช็อต ({data.shots?.shots.length ?? 0})
        </button>
        <button className={view === 'review' ? 'btn-primary' : 'btn-ghost'} onClick={() => setView('review')}>
          รีวิว / อนุมัติ
        </button>
      </div>
      {view === 'shots' ? <ShotGrid id={id} n={n} data={data} reload={reload} /> : <ReviewPlayer id={id} n={n} data={data} reload={reload} />}
    </div>
  );
}

function ShotGrid({ id, n, data, reload }: { id: string; n: number; data: EpisodeDetail; reload: () => void }) {
  const [regen, setRegen] = useState<Shot | null>(null);
  const [notes, setNotes] = useState('');
  if (!data.shots) return <div className="card text-sm text-zinc-400">ยังไม่มี shot list — ให้ Claude เขียนด้วย write_shots</div>;
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <ActionButton className="btn-ghost" onClick={() => api.post(`/api/series/${id}/episodes/${n}/qc`, {}).then(reload)}>
          รัน QC ใหม่
        </ActionButton>
        <ActionButton className="btn-ghost" onClick={() => api.post(`/api/series/${id}/episodes/${n}/assemble`, { quality: 'draft' }).then(reload)}>
          ประกอบดราฟต์
        </ActionButton>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {data.shots.shots.map((s) => {
          const qc = data.qc[s.id];
          const gen = data.gen[s.id];
          const tone = !qc ? 'muted' : qc.review ? (qc.review.pass ? 'ok' : 'bad') : qc.pass ? 'ok' : 'bad';
          return (
            <div key={s.id} className="card p-2">
              <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-zinc-800">
                {gen?.frames[1] ? <img src={fileUrl(id, gen.frames[1])} alt={s.id} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center text-xs text-zinc-500">ยังไม่มีคลิป</div>}
                <div className="absolute left-1 top-1 flex gap-1">
                  <Badge tone={tone}>{!qc ? 'ไม่มี QC' : qc.review ? `รีวิว ${qc.review.pass ? '✓' : '✗'}` : qc.pass ? 'QC ✓' : 'QC ✗'}</Badge>
                  {gen && <Badge tone="muted">v{gen.version}</Badge>}
                </div>
              </div>
              <div className="mt-2 text-xs">
                <div className="font-semibold">
                  {s.id.replace(`${epTag(n)}_`, '')} · {s.type} · {s.duration_sec}s
                </div>
                <div className="line-clamp-2 text-zinc-400">{s.action}</div>
                <div className="mt-1 text-[11px] text-zinc-500">
                  {s.beat} · {s.batch ?? 'ยังไม่จัด batch'} · {s.characters.map((c) => c.id).join(', ') || 'ไม่มีตัวละคร'}
                </div>
                {qc && !qc.pass && !qc.review?.pass && <div className="mt-1 text-[11px] text-rose-300">{qc.reasons.join('; ')}</div>}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {gen && (
                  <button className="btn-ghost px-2 py-1 text-xs" onClick={() => (setRegen(s), setNotes(qc?.reasons.join('; ') ?? ''))}>
                    เจนใหม่
                  </button>
                )}
                {gen && (
                  <ActionButton className="btn-ghost px-2 py-1 text-xs" onClick={() => api.post(`/api/series/${id}/episodes/${n}/shots/${s.id}/review`, { pass: true, reason: 'ดูแล้วผ่าน (dashboard)' }).then(reload)}>
                    ผ่าน
                  </ActionButton>
                )}
                {gen && (
                  <ActionButton className="btn-ghost px-2 py-1 text-xs" onClick={() => api.post(`/api/series/${id}/episodes/${n}/shots/${s.id}/review`, { pass: false, reason: 'ดูแล้วไม่ผ่าน (dashboard)' }).then(reload)}>
                    ไม่ผ่าน
                  </ActionButton>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {regen && (
        <Modal title={`เจนใหม่: ${regen.id}`} onClose={() => setRegen(null)}>
          <div className="mb-2 grid grid-cols-3 gap-1">
            {data.gen[regen.id]?.frames.map((f) => (
              <img key={f} src={fileUrl(id, f)} alt="" className="aspect-[9/16] w-full rounded-lg object-cover" />
            ))}
          </div>
          <label className="label">สิ่งที่ต้องแก้ (fix notes)</label>
          <textarea className="input min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="เช่น หน้ามีนาไม่เหมือน ref, มีคนเกินในฉาก, ภาพดำช่วงท้าย" />
          <div className="mt-3 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setRegen(null)}>
              ยกเลิก
            </button>
            <ActionButton
              onClick={async () => {
                await api.post(`/api/series/${id}/episodes/${n}/shots/${regen.id}/regen`, { fix_notes: notes || 'regenerate' });
                setRegen(null);
                reload();
              }}
            >
              สั่งเจนซ่อม
            </ActionButton>
          </div>
        </Modal>
      )}
    </>
  );
}

function ReviewPlayer({ id, n, data, reload }: { id: string; n: number; data: EpisodeDetail; reload: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [comment, setComment] = useState('');
  const [blockers, setBlockers] = useState<string[] | null>(null);
  const src = data.finals[0] ?? data.previews[0];
  const approve = async (gate: 'G3' | 'G4') => {
    try {
      await api.post(`/api/series/${id}/gates/${gate}`, { episode: n });
      reload();
    } catch (e) {
      const body = (e as { body?: { blockers?: string[] } }).body;
      if (body?.blockers) setBlockers(body.blockers);
      throw e;
    }
  };
  const shotAt = (t: number): string | undefined => {
    const tl = data.timeline;
    if (!tl || !data.shots) return undefined;
    for (const seg of tl.segments) {
      if (seg.kind !== 'clip' || t < seg.start_sec || t >= seg.start_sec + (seg.out_sec - seg.in_sec)) continue;
      let off = seg.start_sec;
      for (const sid of seg.shot_ids) {
        const d = data.shots.shots.find((s) => s.id === sid)?.duration_sec ?? 0;
        if (t < off + d) return sid;
        off += d;
      }
    }
    return undefined;
  };
  return (
    <div className="space-y-4">
      {src ? (
        <video ref={video} src={fileUrl(id, src)} controls playsInline className="w-full max-h-[70vh] rounded-2xl bg-black" />
      ) : (
        <div className="card text-sm text-zinc-400">
          ยังไม่มีไฟล์ดราฟต์ — กด “ประกอบดราฟต์” ในแท็บช็อต หรือสั่ง Claude: assemble quality draft
        </div>
      )}
      <div className="card flex flex-wrap items-center gap-2">
        <div className="text-xs text-zinc-400">{src ? src.split('/').pop() : '—'}</div>
        <span className="flex-1" />
        {!data.state.gates.G3.approved && (
          <ActionButton onClick={() => approve('G3')} confirm="อนุมัติดราฟต์ตอนนี้ (G3)? หลังจากนี้จะเจนตัวจริง/ประกอบไฟล์จบ">
            อนุมัติ G3
          </ActionButton>
        )}
        {data.state.gates.G3.approved && !data.state.gates.G4.approved && (
          <>
            <ActionButton className="btn-ghost" onClick={() => api.post(`/api/series/${id}/episodes/${n}/assemble`, { quality: 'final' }).then(reload)}>
              ประกอบไฟล์จบ
            </ActionButton>
            <ActionButton onClick={() => approve('G4')} confirm="อนุมัติไฟล์จบ (G4)?">
              อนุมัติ G4
            </ActionButton>
          </>
        )}
        {data.state.gates.G4.approved && (
          <ActionButton className="btn-ghost" onClick={() => api.post(`/api/series/${id}/episodes/${n}/export`, {}).then(reload)}>
            ส่งออกไปโฟลเดอร์ export
          </ActionButton>
        )}
      </div>
      {blockers && (
        <Modal title="ยังอนุมัติไม่ได้" onClose={() => setBlockers(null)}>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {blockers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </Modal>
      )}
      <Section title="คอมเมนต์ตามเวลา (ส่งเป็น fix notes ได้)">
        <div className="card space-y-2">
          <div className="flex gap-2">
            <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="พิมพ์สิ่งที่เห็น เช่น หน้าเพี้ยน, ชุดไม่ตรง" />
            <ActionButton
              className="btn-primary whitespace-nowrap"
              onClick={async () => {
                const t = video.current?.currentTime ?? 0;
                if (!comment.trim()) return;
                await api.post(`/api/series/${id}/episodes/${n}/comments`, { t_sec: Math.round(t * 10) / 10, text: comment.trim(), shot_id: shotAt(t) });
                setComment('');
                reload();
              }}
            >
              + ที่ {video.current ? `${(video.current.currentTime || 0).toFixed(1)}s` : 'เวลานี้'}
            </ActionButton>
          </div>
          {data.comments.length === 0 && <div className="text-xs text-zinc-500">ยังไม่มีคอมเมนต์</div>}
          {data.comments.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <button className="text-amber-300" onClick={() => video.current && (video.current.currentTime = c.t_sec)}>
                {c.t_sec.toFixed(1)}s
              </button>
              <span className="flex-1">{c.text}</span>
              {c.shot_id && <Badge tone="muted">{c.shot_id.replace(`${epTag(n)}_`, '')}</Badge>}
              {c.shot_id && (
                <ActionButton className="btn-ghost px-2 py-1 text-xs" onClick={() => api.post(`/api/series/${id}/episodes/${n}/shots/${c.shot_id}/regen`, { fix_notes: c.text }).then(reload)}>
                  เจนซ่อม
                </ActionButton>
              )}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
