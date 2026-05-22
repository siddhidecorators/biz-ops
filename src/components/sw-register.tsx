'use client';

import { useEffect } from 'react';

/**
 * Registers /public/sw.js as the app's service worker, but only in production.
 *
 * Dev mode is deliberately skipped — Next's Turbopack HMR pushes new chunks
 * with fresh hashes every save, and an SW with an active fetch handler would
 * cache stale modules and break Fast Refresh. The cost of not running an SW
 * locally is zero (we don't depend on offline behaviour in dev).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const onReady = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => {
          // Non-blocking: app still works without an SW; we just lose the
          // home-screen install affordance on the next visit.
          console.warn('Service worker registration failed:', err);
        });
    };

    if (document.readyState === 'complete') {
      onReady();
    } else {
      window.addEventListener('load', onReady, { once: true });
      return () => window.removeEventListener('load', onReady);
    }
  }, []);

  return null;
}
