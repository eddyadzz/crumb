/*
 * Crumb service worker — offline shell for bakery floor use.
 *
 * Strategies:
 *  - Precache the offline fallback page + icons at install.
 *  - Cache-first for content-hashed build assets (/ _next/static, icons).
 *  - Network-first for navigations: fresh HTML when online, last-seen page
 *    (or the offline fallback) when the kitchen Wi-Fi drops.
 *
 * Bump CACHE_VERSION to invalidate every cache after a deploy that changes
 * shell behaviour.
 */
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `crumb-static-${CACHE_VERSION}`;
const SHELL_CACHE = `crumb-shell-${CACHE_VERSION}`;
const PAGE_CACHE = `crumb-pages-${CACHE_VERSION}`;
const OWED_CACHES = [STATIC_CACHE, SHELL_CACHE, PAGE_CACHE];

const PRECACHE_URLS = ['/offline', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !OWED_CACHES.includes(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/_next/image/')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache the REST API or auth endpoints.
  if (url.pathname.startsWith('/api/')) return;

  // Content-hashed assets: cache-first (they never change for a given URL).
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Navigations: network-first with cached-page fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match('/offline');
          return (
            offline ||
            new Response('You are offline', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            })
          );
        })
    );
  }
  // Everything else (server actions are POST, API is excluded): pass through.
});
