const CACHE_NAME = 'geofield-v1';

self.addEventListener('install', (event) => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // We don't necessarily need to pre-cache everything for installability,
      // but a fetch handler is required.
      return cache.addAll(['/']);
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate');
});

self.addEventListener('fetch', (event) => {
  // Minimal fetch handler to satisfy PWA requirements
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
