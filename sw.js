const CACHE_NAME = 'carveri-v2.3.04'; // İkonların hemen inmesi için sürüm artırıldı

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './libs/tailwind.js',
  './libs/chart.js',
  './libs/jszip.min.js',

  // --- CARVERI PRO İKONLARI ---
  './iconc-192.png',
  './iconc-512.png',

  // --- CARVERI TRIP DOSYALARI & İKONLARI ---
  './trip/index.html',
  './trip/manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 1. Kurulum: Tüm statik dosyaları önbelleğe al
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// 2. Aktivasyon: Eski sürümleri temizle ve hemen kontrolü ele al
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

// 3. İstek Yönetimi: Çevrimdışı ve Canlı ayrımı
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Canlı Cloudflare Worker botunu önbelleğe alma
  if (url.hostname.includes('workers.dev')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response(JSON.stringify({}), { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      // Önbellekte varsa doğrudan ver
      if (cachedResponse) return cachedResponse;

      // Yoksa internetten çek
      return fetch(e.request).then((networkResponse) => {
        return networkResponse;
      }).catch(() => {
        // İnternet yoksa (Çevrimdışı / Offline Navigasyon)
        if (e.request.mode === 'navigate') {
          if (url.pathname.includes('/trip')) {
            return caches.match('./trip/index.html');
          }
          return caches.match('./index.html');
        }
      });
    })
  );
});
