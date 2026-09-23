// Service Worker for Хэзэнштейн PWA
const CACHE_NAME = 'hazenstein-hz3-v85';
const ASSETS = [
  './',
  './index.html',
  './chaos.webp',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Клик по системному уведомлению: фокусируем открытое приложение (и открываем карточку задачи
// через postMessage) либо запускаем приложение с ?note=<id> — карточка откроется после загрузки.
self.addEventListener('notificationclick', (event) => {
  const noteId = (event.notification.data && event.notification.data.noteId) || null;
  event.notification.close();
  event.waitUntil((async () => {
    const scopeUrl = new URL(self.registration.scope).href; // …/hz3/
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = all.find((c) => { try { return new URL(c.url).href.indexOf(scopeUrl) === 0; } catch (e) { return false; } });
    if (client) {
      try { await client.focus(); } catch (e) {}
      try { client.postMessage({ type: 'hz3-open-note', noteId }); } catch (e) {}
    } else {
      try {
        await self.clients.openWindow(scopeUrl + (noteId ? '?note=' + encodeURIComponent(noteId) : ''));
      } catch (e) {}
    }
  })());
});

// Stale-while-revalidate for HTML (instant open, refresh in background), cache-first for assets
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Skip cross-origin (Google Fonts etc.) — let browser handle them
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate' || req.destination === 'document') {
    // Stale-while-revalidate: отвечаем мгновенно из кэша, свежая версия качается в фоне.
    // Храним всегда под ключом ./index.html; ignoreSearch — чтобы ?v=N не ломал попадание в кэш.
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match('./index.html', { ignoreSearch: true });
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put('./index.html', res.clone()).catch(() => {});
            return res;
          })
          .catch(() => undefined);
        return cached || network.then((res) => res || Response.error());
      })
    );
  } else {
    // Cache-first for assets
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached))
    );
  }
});
