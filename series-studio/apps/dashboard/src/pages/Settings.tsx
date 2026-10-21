import { useEffect, useState } from 'react';
import { api, getToken, setToken } from '../api';
import { ActionButton, ErrorBox, Section, Spinner, useFetch } from '../components/ui';

interface SettingsResp {
  effective: { default_engine: string; export_dir: string; qc: Record<string, number>; assembly: Record<string, number | string>; tools: Record<string, string> };
  local: Record<string, unknown>;
  engines: string[];
  token_hint: string;
}

/** Screen 7: engine, QC thresholds, voice (M7), export folder, token. Writes config/local.json. */
export function Settings() {
  const { data, error, reload } = useFetch(() => api.get<SettingsResp>('/api/settings'), []);
  const [form, setForm] = useState<SettingsResp['effective'] | null>(null);
  const [tok, setTok] = useState(getToken());
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => {
    if (data) setForm(data.effective);
  }, [data]);
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data || !form) return <Spinner />;
  const num = (group: 'qc' | 'assembly', key: string) => (
    <div key={key}>
      <label className="label">{key}</label>
      <input className="input" type="number" step="any" value={Number(form[group][key] ?? 0)} onChange={(e) => setForm({ ...form, [group]: { ...form[group], [key]: Number(e.target.value) } })} />
    </div>
  );
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-bold">ตั้งค่า</h1>
      <Section title="Engine">
        <div className="card">
          <label className="label">engine ตั้งต้นสำหรับซีรีส์ใหม่ (เปลี่ยนแล้วต้องรีสตาร์ท server)</label>
          <select className="input" value={form.default_engine} onChange={(e) => setForm({ ...form, default_engine: e.target.value })}>
            {data.engines.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
      </Section>
      <Section title="QC thresholds">
        <div className="card grid grid-cols-2 gap-2">{Object.keys(form.qc).map((k) => num('qc', k))}</div>
      </Section>
      <Section title="เสียง / ประกอบ">
        <div className="card grid grid-cols-2 gap-2">
          {num('assembly', 'loudness_lufs')}
          {num('assembly', 'music_volume')}
          <div>
            <label className="label">subtitle_font</label>
            <input className="input" value={String(form.assembly['subtitle_font'] ?? '')} onChange={(e) => setForm({ ...form, assembly: { ...form.assembly, subtitle_font: e.target.value } })} />
          </div>
          <div>
            <label className="label">card_font</label>
            <input className="input" value={String(form.assembly['card_font'] ?? '')} onChange={(e) => setForm({ ...form, assembly: { ...form.assembly, card_font: e.target.value } })} />
          </div>
        </div>
      </Section>
      <Section title="โฟลเดอร์ export">
        <div className="card">
          <input className="input" value={form.export_dir} onChange={(e) => setForm({ ...form, export_dir: e.target.value })} />
        </div>
      </Section>
      <Section title="เครื่องมือ (path)">
        <div className="card grid gap-2">
          {Object.entries(form.tools).map(([k, v]) => (
            <div key={k}>
              <label className="label">{k}</label>
              <input className="input" value={v} onChange={(e) => setForm({ ...form, tools: { ...form.tools, [k]: e.target.value } })} />
            </div>
          ))}
        </div>
      </Section>
      <div className="mb-6 flex items-center gap-2">
        <ActionButton
          onClick={async () => {
            const r = await api.put<{ restart_required: boolean }>('/api/settings', form);
            setSaved(r.restart_required ? 'บันทึกแล้ว — ต้องรีสตาร์ท server เพื่อให้ engine/tools มีผล' : 'บันทึกแล้ว มีผลทันที');
            reload();
          }}
        >
          บันทึก
        </ActionButton>
        {saved && <span className="text-xs text-emerald-300">{saved}</span>}
      </div>
      <Section title="Token จับคู่ (dashboard + extension)">
        <div className="card space-y-2">
          <input className="input font-mono" value={tok} onChange={(e) => setTok(e.target.value)} />
          <button
            className="btn-ghost"
            onClick={() => {
              setToken(tok);
              location.reload();
            }}
          >
            ใช้ token นี้
          </button>
          <p className="text-xs text-zinc-500">server บอกว่า token ปัจจุบันขึ้นต้นด้วย {data.token_hint} — ขอลิงก์ใหม่ได้จาก Claude ด้วย dashboard_info</p>
        </div>
      </Section>
    </div>
  );
}
