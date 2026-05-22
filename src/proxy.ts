import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy-helper';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// PWA assets (manifest, service worker) and static binaries must be reachable
// without auth — otherwise the install criteria fail and the SW can't fetch
// itself when a guest visits the sign-in page.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)',
  ],
};
