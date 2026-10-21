import { useEffect, useState } from 'react';
import { getToken } from './api';

/** One WebSocket per page; every "change" bumps a counter so pages refetch. */
const target = new EventTarget();
let socket: WebSocket | null = null;
let retry = 1000;

export function connectLive(): void {
  if (socket && socket.readyState <= 1) return;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  socket = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(getToken())}&role=dashboard`);
  socket.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data as string) as { kind: string };
      if (msg.kind === 'change') target.dispatchEvent(new CustomEvent('change', { detail: msg }));
      if (msg.kind === 'hello') {
        retry = 1000;
        target.dispatchEvent(new CustomEvent('status', { detail: 'online' }));
      }
    } catch {
      /* ignore */
    }
  };
  socket.onclose = () => {
    target.dispatchEvent(new CustomEvent('status', { detail: 'offline' }));
    setTimeout(connectLive, retry);
    retry = Math.min(retry * 2, 15000);
  };
  socket.onerror = () => socket?.close();
}

/** Re-render counter that increments on every server change event. */
export function useLiveVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const h = () => setV((x) => x + 1);
    target.addEventListener('change', h);
    return () => target.removeEventListener('change', h);
  }, []);
  return v;
}

export function useLiveStatus(): 'online' | 'offline' {
  const [s, setS] = useState<'online' | 'offline'>('offline');
  useEffect(() => {
    const h = (e: Event) => setS((e as CustomEvent<'online' | 'offline'>).detail);
    target.addEventListener('status', h);
    return () => target.removeEventListener('status', h);
  }, []);
  return s;
}
