'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  const [persister] = useState(makePersister);

  if (!persister) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: ONE_DAY_MS,
        buster: CACHE_BUSTER,
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
