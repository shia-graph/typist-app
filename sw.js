const CACHE_NAME = 'typist-app-v2'; // نام کش تغییر کرد تا فایل‌های قدیمی پاک شوند
const urlsToCache = ['./', './index.html', './manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  // استراتژی جدید: اول از اینترنت بگیر، اگر اینترنت نبود از کش بخوان
  event.respondWith(
    fetch(event.request)
      .then(response => {
        return response || caches.match(event.request);
      })
      .catch(() => caches.match(event.request))
  );
});
