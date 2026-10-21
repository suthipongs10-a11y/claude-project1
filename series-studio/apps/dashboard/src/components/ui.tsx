import { useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '../api';

export function Badge({ tone, children }: { tone: 'ok' | 'bad' | 'warn' | 'muted' | 'info'; children: ReactNode }) {
  const cls = { ok: 'bg-emerald-500/20 text-emerald-300', bad: 'bg-rose-500/20 text-rose-300', warn: 'bg-amber-500/20 text-amber-300', muted: 'bg-zinc-700/60 text-zinc-300', info: 'bg-sky-500/20 text-sky-300' }[tone];
  return <span className={`badge ${cls}`}>{children}</span>;
}

export function Spinner({ label = 'กำลังโหลด…' }: { label?: string }) {
  return <div className="py-10 text-center text-sm text-zinc-500">{label}</div>;
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof ApiError ? `${error.message}${error.status === 401 ? ' — เปิดลิงก์จาก dashboard_info อีกครั้ง' : ''}` : error instanceof Error ? error.message : String(error);
  return (
    <div className="card border-rose-900 bg-rose-950/40 text-sm text-rose-200">
      <div className="whitespace-pre-wrap">{msg}</div>
      {onRetry && (
        <button className="btn-ghost mt-2" onClick={onRetry}>
          ลองใหม่
        </button>
      )}
    </div>
  );
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-300">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl bg-zinc-900 p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button className="btn-ghost px-2 py-1" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Button that runs an async action, shows busy state and surfaces errors inline. */
export function ActionButton({ onClick, className = 'btn-primary', children, confirm }: { onClick: () => Promise<unknown>; className?: string; children: ReactNode; confirm?: string | undefined }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        className={className}
        disabled={busy}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          setBusy(true);
          setErr(null);
          try {
            await onClick();
          } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? '…' : children}
      </button>
      {err && <span className="max-w-xs whitespace-pre-wrap text-xs text-rose-300">{err}</span>}
    </span>
  );
}

export function statusLabel(s: string): string {
  const m: Record<string, string> = {
    planning: 'วางแผน', bible_approved: 'เรื่องผ่าน (G1)', assets_locked: 'ล็อก asset แล้ว (G2)', production: 'กำลังผลิต', complete: 'จบซีซัน',
    planned: 'วางแผน', scripted: 'มีบท', shots_ready: 'มี shot list', prompts_ready: 'มี prompt', generating: 'กำลังเจน', qc: 'รอ QC/รีวิว',
    draft_approved: 'ดราฟต์ผ่าน (G3)', assembling: 'กำลังประกอบ', final_ready: 'ไฟล์จบพร้อม (G4)', exported: 'ส่งออกแล้ว',
    queued: 'รอคิว', running: 'กำลังทำ', awaiting_import: 'รอ import', done: 'เสร็จ', failed: 'ล้มเหลว', cancelled: 'ยกเลิก',
  };
  return m[s] ?? s;
}

export function useFetch<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; error: unknown; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    fn().then((d) => alive && (setData(d), setError(null))).catch((e) => alive && setError(e));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, reload: () => setTick((x) => x + 1) };
}
