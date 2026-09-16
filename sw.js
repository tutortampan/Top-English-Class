const CACHE_NAME = 'abcd-system-v4.0.6';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './admin.html',
  './dashboard.html',
  './exam.html',
  './result.html',
  './css/style.css?v=4.0',
  './css/admin.css?v=4.0',
  './css/dashboard.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;
  // Skip caching API/Supabase calls
  if (event.request.url.includes('supabase.co')) return;

  const url = new URL(event.request.url);
  const isScriptOrDoc = event.request.destination === 'script' || 
                        event.request.destination === 'document' || 
                        url.pathname.endsWith('.js') || 
                        url.pathname.endsWith('.html');

  if (isScriptOrDoc) {
    // Network-first for scripts and documents so bug fixes and updates propagate immediately
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for other static assets (images, fonts, static css)
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    }).catch(() => {
      // Fallback
    })
  );
});
