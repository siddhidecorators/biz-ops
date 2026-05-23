'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';

// Bump when the cache shape changes (query keys renamed, row shapes changed)
// to discard stale persisted state on next load instead of mis-hydrating.
const CACHE_BUSTER = 'v1';
const CACHE_KEY = 'smallbiz-ops:rq-cache';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Background-refetch threshold. Mounting a query inside this window
        // serves cache instantly with no network call.
        staleTime: 30_000,
        // Keep evicted queries in memory for 24h so back/forward nav reuses them.
        gcTime: ONE_DAY_MS,
        retry: 1,
        refetchOnWindowFocus: true,
      },
      mutations: {
        // Mutations capture their optimistic state immediately, then pause
        // the fetch portion when offline. They resume automatically when
        // the onlineManager flips back to true (see PersistQueryClient docs).
        networkMode: 'offlineFirst',
        // Retry once on transient errors that aren't pure offline conditions
        // (DNS hiccups, 5xx, etc). Offline pauses don't count as retries.
        retry: 1,
      },
    },
  });
}

function makePersister() {
  if (typeof window === 'undefined') return null;
  return createAsyncStoragePersister({
    storage: {
      getItem: async (k) => (await get<string>(k)) ?? null,
      setItem: async (k, v) => {
        await set(k, v);
      },
      removeItem: async (k) => {
        await del(k);
      },
    },
    key: CACHE_KEY,
    throttleTime: 1000,
  });
}

function ResumeMutationsOnReconnect({ children }: { children: ReactNode }) {
  // No QueryClient access here — we rely on onlineManager being the same
  // singleton TanStack uses for the provider above, and on persisted-cache
  // restoration triggering resume via PersistQueryClientProvider's
  // onSuccess hook. Belt-and-braces: also call when the tab regains focus.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => onlineManager.setOnline(true);
    const handleOffline = () => onlineManager.setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    // Seed initial state from the current navigator status.
    onlineManager.setOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  return <>{children}</>;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  const [persister] = useState(makePersister);

  if (!persister) {
    return (
      <QueryClientProvider client={client}>
        <ResumeMutationsOnReconnect>{children}</ResumeMutationsOnReconnect>
      </QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: ONE_DAY_MS,
        buster: CACHE_BUSTER,
      }}
      onSuccess={() => {
        // After cache restore, any paused mutations from a prior session
        // can resume now that fns are mounted again. Safe to call when there
        // are none — it's a no-op.
        client.resumePausedMutations();
      }}
    >
      <ResumeMutationsOnReconnect>{children}</ResumeMutationsOnReconnect>
    </PersistQueryClientProvider>
  );
}
