const CACHE_NAME = 'carveri-v2.3.01';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './libs/tailwind.js',
  './libs/chart.js',
  './libs/jszip.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Canlı fiyat botunu önbelleğe alma, internet varsa doğrudan getir
  if (url.hostname.includes('workers.dev')) {
    e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({}), { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(e.request).catch(() => {
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
