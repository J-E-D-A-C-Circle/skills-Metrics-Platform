// =============================================================================
// sw-take.js · Service Worker for offline assessment execution (/take)
// Caches assessment packages, shell assets and provides offline fallback
// =============================================================================

const CACHE_NAME = 'dvla-assessment-cache-v1';
const PRECACHE_ASSETS = [
  '/',
  '/take',
  '/assessments',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        console.warn('[SW] Pre-caching non-fatal warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // For assessment endpoints, use network-first with cache fallback
  if (url.pathname.startsWith('/api/my/assessments') || url.pathname.startsWith('/api/attempts')) {
    // Only cache GET requests
    if (event.request.method === 'GET') {
      event.respondWith(
        fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
            }
            return networkResponse;
          })
          .catch(async () => {
            const cached = await caches.match(event.request);
            if (cached) return cached;
            return new Response(JSON.stringify({ offline: true, message: 'Serving from offline client storage' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          })
      );
      return;
    }
  }

  // Static assets and pages: Stale-while-revalidate or Network-first
  if (event.request.method === 'GET' && (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/take'))) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
            }
            return networkResponse;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});
