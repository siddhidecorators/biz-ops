'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatDateDMY } from '@/lib/format';
import { LEAD_STATUS_LABELS, LEAD_STATUSES, type LeadStatus } from '@/lib/enums';
import { leadKeys, fetchLeads, type LeadListRow } from '@/lib/queries/leads';
import { AppBar } from '../../_components/app-bar';

const STATUS_STYLE: Record<LeadStatus, string> = {
  new: 'bg-sky-500/10 text-sky-700 ring-sky-500/30 dark:text-sky-300',
  contacted: 'bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300',
  quoted: 'bg-brand-tint text-primary ring-primary/30',
  won: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
  lost: 'bg-muted text-muted-foreground ring-border',
};

export function LeadsList({ initialData }: { initialData?: LeadListRow[] }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: leadKeys.list(),
    queryFn: () => fetchLeads(),
    initialData,
  });
  const [filter, setFilter] = useState<'all' | LeadStatus>('all');

  const leads = data ?? [];
  const open = leads.filter((l) => l.status !== 'won' && l.status !== 'lost').length;
  const filtered = filter === 'all' ? leads : leads.filter((l) => l.status === filter);

  return (
    <>
      <AppBar
        title="Leads"
        subtitle={open > 0 ? `${open} open` : undefined}
        right={
          <Link
            href="/leads/new"
            aria-label="Add lead"
            className="inline-flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 active:opacity-90"
          >
            <PlusIcon className="size-5" />
          </Link>
        }
      />

      <main className="mx-auto max-w-md px-6 py-5">
        {leads.length > 0 && (
          <div className="mb-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 text-xs">
            <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
              All
            </Chip>
            {LEAD_STATUSES.map((s) => (
              <Chip key={s} active={filter === s} onClick={() => setFilter(s)}>
                {LEAD_STATUS_LABELS[s]}
              </Chip>
            ))}
          </div>
        )}

        {isError ? (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error instanceof Error ? error.message : 'Something went wrong.'}
          </p>
        ) : isPending ? (
          <Skeleton />
        ) : leads.length === 0 ? (
          <EmptyState />
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">No leads in this stage.</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {filtered.map((l) => (
              <LeadRow key={l.id} lead={l} />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full px-3 py-1 ring-1 transition-colors',
        active
          ? 'bg-primary text-primary-foreground ring-primary'
          : 'bg-card text-muted-foreground ring-border hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}

function Skeleton() {
  return (
    <ul aria-hidden className="space-y-2.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i}>
          <Card size="sm">
            <CardContent className="space-y-2">
              <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
              <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
      <p className="text-base font-medium">No leads yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Log a walk-in, call or referral so it doesn&apos;t slip — then turn it into a quote.
      </p>
      <Link
        href="/leads/new"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
      >
        Add your first lead
      </Link>
    </div>
  );
}

function LeadRow({ lead: l }: { lead: LeadListRow }) {
  const sub = [l.source, l.phone].filter(Boolean).join(' · ');
  return (
    <li>
      <Link href={`/leads/${l.id}`} className="block">
        <Card size="sm" className="transition-colors hover:bg-muted/60">
          <CardContent className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-base font-medium">{l.name}</p>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1',
                  STATUS_STYLE[l.status],
                )}
              >
                {LEAD_STATUS_LABELS[l.status]}
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {sub || 'No contact details'} · {formatDateDMY(l.created_at)}
            </p>
          </CardContent>
        </Card>
      </Link>
    </li>
  );
}
