const CACHE_NAME = 'carveri-v2.3.02'; // Yeni dosyaların hemen inmesi için sürüm artırıldı

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './libs/tailwind.js',
  './libs/chart.js',
  './libs/jszip.min.js',
  // --- CARVERI TRIP DOSYALARI EKLENDİ ---
  './trip/index.html',
  './trip/manifest.json'
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
    e.respondWith(
      fetch(e.request).catch(() => new Response(JSON.stringify({}), { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(e.request).catch(() => {
        // Çevrimdışıyken navigasyon yönlendirmesi
        if (e.request.mode === 'navigate') {
          // Eğer /trip/ sayfasındaysan trip'i aç, ana sayfadaysan ana Carveriyi aç
          if (url.pathname.includes('/trip')) {
            return caches.match('./trip/index.html');
          }
          return caches.match('./index.html');
        }
      });
    })
  );
});
