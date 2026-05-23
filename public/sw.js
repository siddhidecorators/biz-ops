// SmallBiz Ops — service worker
//
// Two caches:
//   static  — content-hashed JS/CSS/fonts under /_next/static. Immutable, so
//             cache-first with no revalidation.
//   shell   — HTML document responses for same-origin app routes. Stale-while-
//             revalidate: serve cache instantly, fetch fresh in background.
//
// Bump VERSION on any change to evict old caches.

const VERSION = 'smallbiz-ops-v2';
const STATIC_CACHE = `${VERSION}-static`;
const SHELL_CACHE = `${VERSION}-shell`;

self.addEventListener('install', () => {
  // Activate the new SW immediately instead of waiting for tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // Drop anything that doesn't belong to the current VERSION prefix.
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Only handle same-origin traffic. Cross-origin (Supabase, Google fonts CDN,
  // etc.) is skipped — they have their own cache headers and auth concerns.
  if (url.origin !== self.location.origin) return;

  // Skip auth-sensitive routes outright — never cache anything that might
  // expose a private response.
  if (url.pathname.startsWith('/auth/')) return;

  // Skip the service worker itself and the manifest (browser handles them).
  if (url.pathname === '/sw.js' || url.pathname === '/manifest.webmanifest') {
    return;
  }

  // Static, content-hashed assets — cache-first.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // Document navigations — stale-while-revalidate so the second launch is
  // instant from cache while the background fetch keeps it fresh.
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
    return;
  }

  // Anything else (favicons, public images): cache-first with network fallback.
  event.respondWith(cacheFirst(req, STATIC_CACHE));
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    // Last resort: if cache had a match for a related URL (e.g. ignoring
    // search params), return it. Otherwise propagate the network error.
    const fallback = await cache.match(req, { ignoreSearch: true });
    if (fallback) return fallback;
    throw err;
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkPromise = fetch(req)
    .then((res) => {
      // Only cache successful, basic (same-origin) HTML responses.
      if (res.ok && res.type === 'basic') {
        cache.put(req, res.clone());
      }
      return res;
    })
    .catch(() => cached);
  // If we have a cached copy, return it now; the network update keeps the
  // cache fresh in the background. If not, await the network.
  return cached || networkPromise;
}
