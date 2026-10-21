// Minimal app-shell cache. API/media always go to the network (they carry the token and change often).
const SHELL = 'series-studio-shell-v1';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon.svg'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/files/') || url.pathname === '/ws') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && (url.pathname === '/' || url.pathname.startsWith('/assets/'))) {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('/'))),
  );
});
