'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CUSTOMER_TYPE_LABELS } from '@/lib/enums';
import {
  customerKeys,
  fetchCustomersList,
  type CustomerListRow,
} from '@/lib/queries/customers';
import { AppBar } from '../../_components/app-bar';

const SEARCH_DEBOUNCE_MS = 200;

export function CustomersList({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [term, setTerm] = useState(initialQuery);
  const [appliedTerm, setAppliedTerm] = useState(initialQuery);

  // Debounce keystrokes into the query the cache + URL use.
  useEffect(() => {
    const handle = setTimeout(() => setAppliedTerm(term.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [term]);

  // Mirror the applied search into the URL so refresh and share keep state.
  useEffect(() => {
    const current = searchParams.get('q') ?? '';
    if (current === appliedTerm) return;
    const next = new URLSearchParams(searchParams.toString());
    if (appliedTerm) next.set('q', appliedTerm);
    else next.delete('q');
    const qs = next.toString();
    router.replace(qs ? `/customers?${qs}` : '/customers', { scroll: false });
  }, [appliedTerm, router, searchParams]);

  const {
    data: customers,
    isPending,
    isError,
    error,
    isPlaceholderData,
  } = useQuery({
    queryKey: customerKeys.list(appliedTerm),
    queryFn: () => fetchCustomersList(appliedTerm),
    // Keep showing the previous result while a new search loads — no blink.
    placeholderData: (prev) => prev,
  });

  const total = customers?.length ?? 0;

  return (
    <>
      <AppBar
        title="Customers"
        subtitle={total > 0 ? `${total} total` : undefined}
        right={
          <Link
            href="/customers/new"
            aria-label="Add customer"
            className="inline-flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 active:opacity-90"
          >
            <PlusIcon className="size-5" />
          </Link>
        }
      />

      <main className="mx-auto max-w-md px-6 py-5">
        <div className="mb-5 space-y-2">
          <Label htmlFor="q" className="sr-only">
            Search
          </Label>
          <Input
            id="q"
            name="q"
            type="search"
            placeholder="Search by name or phone"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            inputMode="search"
            enterKeyHint="search"
            className="h-11"
          />
          {term && (
            <button
              type="button"
              onClick={() => setTerm('')}
              className="inline-block text-xs text-muted-foreground underline underline-offset-2"
            >
              Clear search
            </button>
          )}
        </div>

        {isError ? (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error instanceof Error ? error.message : 'Something went wrong.'}
          </p>
        ) : isPending ? (
          <CustomerListSkeleton />
        ) : customers.length === 0 ? (
          <EmptyState hasSearch={!!appliedTerm} />
        ) : (
          <ul
            className={
              'divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 ' +
              (isPlaceholderData ? 'opacity-70 transition-opacity' : '')
            }
          >
            {customers.map((c) => (
              <CustomerRow key={c.id} customer={c} />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function CustomerListSkeleton() {
  return (
    <ul
      aria-hidden
      className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <span className="size-10 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  if (hasSearch) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">No customers match your search.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
      <p className="text-base font-medium">No customers yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Add Pankaj&apos;s first customer to start invoicing.
      </p>
      <Link
        href="/customers/new"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
      >
        Add your first customer
      </Link>
    </div>
  );
}

function CustomerRow({ customer: c }: { customer: CustomerListRow }) {
  const initials = initialsFromName(c.name);
  return (
    <li>
      <Link
        href={`/customers/${c.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-muted active:bg-muted"
      >
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-tint text-sm font-medium text-primary"
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium leading-tight">{c.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {CUSTOMER_TYPE_LABELS[c.customer_type]}
            {' · '}
            {c.phone}
            {c.billing_city ? ` · ${c.billing_city}` : ''}
          </p>
        </div>
        <span aria-hidden className="text-muted-foreground">
          ›
        </span>
      </Link>
    </li>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
