'use strict';

// نسخه را بالا ببرید تا SW قدیمی پاک شود
const CACHE_NAME = 'typist-app-v3';

// فایل‌هایی که باید کش شوند
const PRECACHE = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
];

// ============== install ==============
self.addEventListener('install', (event) => {
  self.skipWaiting(); // فوراً SW جدید فعال شود
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE).catch((err) => {
        console.warn('[SW] precache partial fail:', err);
      }))
  );
});

// ============== activate ==============
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim()) // کنترل فوری همه تب‌ها
  );
});

// ============== fetch ==============
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // فقط GET
  if (req.method !== 'GET') return;

  // برای درخواست‌های HTML: Network-First
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match('./index.html'))
        )
    );
    return;
  }

  // برای فایل‌های دیگر: Cache-First با به‌روزرسانی پس‌زمینه
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// ============== skipWaiting از سمت صفحه ==============
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
