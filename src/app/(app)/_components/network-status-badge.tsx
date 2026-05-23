'use client';

import { useEffect, useState } from 'react';
import {
  onlineManager,
  useMutationState,
} from '@tanstack/react-query';
import { WifiOffIcon, RefreshCwIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Floating badge that surfaces network + mutation-queue state.
 *
 * States, in priority order:
 *   - Offline with pending mutations  → "Offline · N pending"
 *   - Offline with nothing pending    → "Offline"
 *   - Online with pending mutations   → "Syncing N…" (after coming back online,
 *                                       mutations resume here)
 *   - Online with nothing pending     → hidden
 */
export function NetworkStatusBadge() {
  const [online, setOnline] = useState(true);

  // Subscribe to TanStack's onlineManager so we react to its forced state
  // toggles (e.g. from preview_eval tests) as well as the browser events.
  useEffect(() => {
    setOnline(onlineManager.isOnline());
    const unsubscribe = onlineManager.subscribe((next) => setOnline(next));
    return unsubscribe;
  }, []);

  // Pending mutations include both "queued because offline" and "in-flight
  // online" — both worth surfacing so the user knows something's mid-sync.
  const pendingCount = useMutationState({
    filters: { status: 'pending' },
  }).length;

  if (online && pendingCount === 0) return null;

  const label = !online
    ? pendingCount > 0
      ? `Offline · ${pendingCount} pending`
      : 'Offline'
    : `Syncing ${pendingCount}…`;

  const Icon = !online ? WifiOffIcon : RefreshCwIcon;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-2 z-40 flex justify-center px-3"
    >
      <span
        className={cn(
          'pointer-events-auto flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium shadow-sm ring-1 backdrop-blur',
          !online
            ? 'bg-amber-500/90 text-white ring-amber-600/30'
            : 'bg-sky-500/90 text-white ring-sky-600/30',
        )}
      >
        <Icon className={cn('size-3.5', online && 'animate-spin')} />
        {label}
      </span>
    </div>
  );
}
