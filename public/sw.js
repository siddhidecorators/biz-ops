// SmallBiz Ops — minimal service worker.
//
// Why this file exists:
//   Chrome's PWA install criteria require a registered service worker with a
//   fetch handler. We don't actually need offline caching yet — that comes in
//   Phase 2 when we want quotes/invoices to be draftable offline. For now this
//   SW is a no-op pass-through: it satisfies the install criteria without
//   interfering with normal network requests.
//
// Versioning:
//   Bumping VERSION on a new release will force every client to refresh on the
//   next visit. Keep it in sync with package.json when we ship breaking PWA
//   behaviour changes.

const VERSION = 'smallbiz-ops-v1';

self.addEventListener('install', () => {
  // Take over from any previous SW immediately on first install.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Wipe any caches from previous versions so stale assets don't linger
      // after a deploy. Until we start caching, this is just a safety net.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', () => {
  // Intentional no-op: required for installability, otherwise just let the
  // browser handle the request normally.
});
