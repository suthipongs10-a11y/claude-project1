import { useState } from 'react';
import { api, type StyleRow } from '../api';
import { go } from '../router';
import { ActionButton, ErrorBox, Spinner, useFetch } from '../components/ui';

const MEDIUM_LABEL: Record<string, string> = { live_action: 'คนแสดงจริง', '2d': '2D', '3d': '3D', mixed: 'ผสม' };
const DIALOGUE_LABEL: Record<string, string> = { native: 'พูดไทยในโมเดล', dub: 'พากย์ทับ', narration: 'เสียงบรรยาย', sfx_only: 'เสียงประกอบเท่านั้น' };

/** Screen 1 wizard: idea -> style -> aspect -> episodes. The series is created; Claude writes bible/outline from chat. */
export function SeriesWizard() {
  const { data, error } = useFetch(() => api.get<{ styles: StyleRow[] }>('/api/styles'), []);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ id: '', title: '', logline: '', style_id: '', aspect: '9:16' as '9:16' | '16:9', episodes: 10, ep_length_sec: 90 });
  const style = data?.styles.find((s) => s.id === form.style_id);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const steps = ['ไอเดีย', 'สไตล์', 'อัตราส่วน', 'จำนวนตอน'];
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-xl font-bold">สร้างซีรีส์ใหม่</h1>
      <div className="mb-4 flex gap-1 text-xs text-zinc-400">
        {steps.map((s, i) => (
          <span key={s} className={`rounded-full px-2 py-0.5 ${i === step ? 'bg-amber-400 text-zinc-950' : i < step ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800'}`}>
            {i + 1}. {s}
          </span>
        ))}
      </div>
      {error ? <ErrorBox error={error} /> : null}
      {step === 0 && (
        <div className="card space-y-3">
          <div>
            <label className="label">ชื่อเรื่อง</label>
            <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="เช่น ความลับหน้าคาเฟ่" />
          </div>
          <div>
            <label className="label">id (a-z, 0-9, -) สำหรับโฟลเดอร์</label>
            <input className="input" value={form.id} onChange={(e) => set('id', e.target.value.toLowerCase())} placeholder="cafe-secret" />
          </div>
          <div>
            <label className="label">ไอเดีย / logline</label>
            <textarea className="input min-h-24" value={form.logline} onChange={(e) => set('logline', e.target.value)} placeholder="บาริสต้าสาวพบว่าลูกค้าประจำคือคนที่เธอตามหามาทั้งชีวิต…" />
          </div>
          <button className="btn-primary w-full" disabled={!form.title || !form.logline || !/^[a-z0-9][a-z0-9_-]*$/.test(form.id)} onClick={() => setStep(1)}>
            ต่อไป
          </button>
        </div>
      )}
      {step === 1 && (
        <div className="space-y-2">
          {!data && <Spinner />}
          {data?.styles.map((s) => (
            <button key={s.id} className={`card w-full text-left ${form.style_id === s.id ? 'border-amber-400' : ''}`} onClick={() => set('style_id', s.id)}>
              <div className="flex items-center justify-between">
                <div className="font-semibold">{s.label}</div>
                <div className="text-xs text-zinc-400">{s.id}</div>
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                {MEDIUM_LABEL[s.medium] ?? s.medium} · {DIALOGUE_LABEL[s.dialogue_mode] ?? s.dialogue_mode} · {s.aspect_modes.join(' / ')}
              </div>
              {s.notes && <div className="mt-1 text-xs text-zinc-500">{s.notes}</div>}
            </button>
          ))}
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setStep(0)}>
              กลับ
            </button>
            <button className="btn-primary flex-1" disabled={!form.style_id} onClick={() => setStep(2)}>
              ต่อไป
            </button>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="card space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(['9:16', '16:9'] as const).map((a) => {
              const allowed = !style || style.aspect_modes.includes(a);
              return (
                <button key={a} disabled={!allowed} className={`card text-center ${form.aspect === a ? 'border-amber-400' : ''} ${allowed ? '' : 'opacity-40'}`} onClick={() => set('aspect', a)}>
                  <div className={`mx-auto mb-2 rounded border border-zinc-600 ${a === '9:16' ? 'h-16 w-9' : 'h-9 w-16'}`} />
                  <div className="font-semibold">{a}</div>
                  <div className="text-xs text-zinc-400">{a === '9:16' ? 'แนวตั้ง (Shorts/Reels/TikTok)' : 'แนวนอน (YouTube)'}</div>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setStep(1)}>
              กลับ
            </button>
            <button className="btn-primary flex-1" onClick={() => setStep(3)}>
              ต่อไป
            </button>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="card space-y-3">
          <div>
            <label className="label">จำนวนตอน</label>
            <input className="input" type="number" min={1} max={999} value={form.episodes} onChange={(e) => set('episodes', Number(e.target.value))} />
          </div>
          <div>
            <label className="label">ความยาวต่อตอน (วินาที)</label>
            <input className="input" type="number" min={10} value={form.ep_length_sec} onChange={(e) => set('ep_length_sec', Number(e.target.value))} />
          </div>
          <div className="text-xs text-zinc-400">
            สรุป: “{form.title}” · {style?.label} · {form.aspect} · {form.episodes} ตอน × {form.ep_length_sec}s
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setStep(2)}>
              กลับ
            </button>
            <ActionButton
              className="btn-primary flex-1"
              onClick={async () => {
                const r = await api.post<{ series: { id: string } }>('/api/series', form);
                go(`#/s/${r.series.id}`);
              }}
            >
              สร้างซีรีส์
            </ActionButton>
          </div>
          <p className="text-xs text-zinc-500">หลังสร้างแล้ว ให้ Claude เขียน bible และ outline จากแชท (prompt plan_series) แล้วกลับมาอนุมัติ G1 ที่นี่</p>
        </div>
      )}
    </div>
  );
}
