// SmallBiz Ops — service worker
//
// SCOPE (deliberately minimal): cache ONLY immutable, content-hashed static
// assets under /_next/static. Everything else — page navigations, RSC payloads,
// API calls, auth — is left to the network untouched.
//
// Why so conservative: caching HTML/navigation responses in a Next.js App
// Router app is a footgun. A cached page references specific JS chunk hashes;
// after a deploy those hashes change, so a stale cached page loads dead chunks
// and the app breaks for returning users (e.g. forms silently stop working).
// We hit exactly that. The offline DATA story does NOT depend on this SW — it
// lives in TanStack Query + IndexedDB. This SW exists only for PWA
// installability + fast static-asset loads.
//
// Bump VERSION on any change; activate() purges every cache that doesn't match,
// so a broken predecessor self-heals on the next visit.

const VERSION = 'smallbiz-ops-v3';
const STATIC_CACHE = `${VERSION}-static`;

self.addEventListener('install', () => {
  // Replace any previous SW immediately rather than waiting for tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Delete ALL caches not belonging to the current VERSION — this wipes the
      // bad v2 SHELL_CACHE that was serving stale pages.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // ONLY intercept immutable, content-hashed build assets. Cache-first is safe
  // here because the filename changes whenever the content changes.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // Everything else (pages, RSC payloads, data, auth, images): do nothing —
  // let the browser fetch from the network normally. No stale-cache risk.
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}
