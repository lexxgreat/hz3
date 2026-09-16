// Service Worker for Хэзэнштейн PWA
const CACHE_NAME = 'hazenstein-hz3-v58';
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
