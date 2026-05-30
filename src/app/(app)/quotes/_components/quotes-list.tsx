'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatINR, formatDateDMY } from '@/lib/format';
import { QUOTE_STATUS_LABELS, type QuoteStatus } from '@/lib/enums';
import {
  quoteKeys,
  fetchQuotesList,
  type QuoteListRow,
} from '@/lib/queries/quotes';
import { AppBar } from '../../_components/app-bar';

const STATUS_STYLE: Record<QuoteStatus, string> = {
  draft: 'bg-muted text-muted-foreground ring-border',
  sent: 'bg-sky-500/10 text-sky-700 ring-sky-500/30 dark:text-sky-300',
  accepted: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
  declined: 'bg-rose-500/10 text-rose-700 ring-rose-500/30 dark:text-rose-300',
  converted_to_invoice: 'bg-brand-tint text-primary ring-primary/30',
  expired: 'bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300',
};

export function QuotesList({ initialData }: { initialData?: QuoteListRow[] }) {
  const {
    data: quotes,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: quoteKeys.list(),
    queryFn: () => fetchQuotesList(),
    initialData,
  });

  const [term, setTerm] = useState('');
  const q = term.trim().toLowerCase();
  const filtered =
    q && quotes
      ? quotes.filter(
          (x) =>
            x.quote_number.toLowerCase().includes(q) ||
            (x.customers?.name ?? '').toLowerCase().includes(q) ||
            (x.project_label ?? '').toLowerCase().includes(q),
        )
      : quotes;

  const total = quotes?.length ?? 0;

  return (
    <>
      <AppBar
        title="Quotes"
        subtitle={total > 0 ? `${total} total` : undefined}
        right={
          <Link
            href="/quotes/new"
            aria-label="New quote"
            className="inline-flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 active:opacity-90"
          >
            <PlusIcon className="size-5" />
          </Link>
        }
      />

      <main className="mx-auto max-w-md px-6 py-5">
        {isError ? (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error instanceof Error ? error.message : 'Something went wrong.'}
          </p>
        ) : isPending ? (
          <QuotesSkeleton />
        ) : total === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="mb-4">
              <Input
                type="search"
                inputMode="search"
                aria-label="Search quotes"
                placeholder="Search by number, customer, or project"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="h-11"
              />
            </div>
            {filtered!.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">No quotes match your search.</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {filtered!.map((qt) => (
                  <QuoteRow key={qt.id} quote={qt} />
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </>
  );
}

function QuotesSkeleton() {
  return (
    <ul aria-hidden className="space-y-2.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i}>
          <Card size="sm">
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 w-16 animate-pulse rounded-full bg-muted" />
              </div>
              <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
              <div className="flex items-baseline justify-between pt-1">
                <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              </div>
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
      <p className="text-base font-medium">No quotes yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Build the first quote — share a PDF on WhatsApp, then convert it to an invoice when work is
        done.
      </p>
      <Link
        href="/quotes/new"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
      >
        Create your first quote
      </Link>
    </div>
  );
}

function QuoteRow({ quote: q }: { quote: QuoteListRow }) {
  return (
    <li>
      <Link href={`/quotes/${q.id}`} className="block">
        <Card size="sm" className="transition-colors hover:bg-muted/60">
          <CardContent className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium text-muted-foreground">
                {q.quote_number}
              </p>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1',
                  STATUS_STYLE[q.status],
                )}
              >
                {QUOTE_STATUS_LABELS[q.status]}
              </span>
            </div>
            <p className="truncate text-base font-medium">{q.customers?.name ?? '—'}</p>
            {q.project_label && (
              <p className="truncate text-xs text-muted-foreground">{q.project_label}</p>
            )}
            <div className="flex items-baseline justify-between pt-1 text-xs text-muted-foreground">
              <span>
                {formatDateDMY(q.issue_date)} · valid till {formatDateDMY(q.valid_until)}
              </span>
              <span className="text-sm font-semibold text-foreground">
                {formatINR(q.total)}
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </li>
  );
}
