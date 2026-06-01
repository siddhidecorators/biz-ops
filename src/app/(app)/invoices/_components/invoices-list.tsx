'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatINR, formatDateDMY } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { PAYMENT_BADGE, PAYMENT_STATUS_LABELS } from '@/lib/status-badges';
import {
  invoiceKeys,
  fetchInvoicesList,
  type InvoiceListRow,
} from '@/lib/queries/invoices';
import { AppBar } from '../../_components/app-bar';

export function InvoicesList({ initialData }: { initialData?: InvoiceListRow[] }) {
  const {
    data: invoices,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: invoiceKeys.list(),
    queryFn: () => fetchInvoicesList(),
    initialData,
  });

  const [term, setTerm] = useState('');
  const q = term.trim().toLowerCase();
  const filtered =
    q && invoices
      ? invoices.filter(
          (x) =>
            x.invoice_number.toLowerCase().includes(q) ||
            (x.customers?.name ?? '').toLowerCase().includes(q) ||
            (x.project_label ?? '').toLowerCase().includes(q),
        )
      : invoices;

  const total = invoices?.length ?? 0;

  return (
    <>
      <AppBar
        title="Invoices"
        subtitle={total > 0 ? `${total} total` : undefined}
        right={
          <Link
            href="/invoices/new"
            aria-label="New invoice"
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
          <InvoicesSkeleton />
        ) : total === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="mb-4">
              <Input
                type="search"
                inputMode="search"
                aria-label="Search invoices"
                placeholder="Search by number, customer, or project"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="h-11"
              />
            </div>
            {filtered!.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">No invoices match your search.</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {filtered!.map((inv) => (
                  <InvoiceRow key={inv.id} invoice={inv} />
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </>
  );
}

function InvoicesSkeleton() {
  return (
    <ul aria-hidden className="space-y-2.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i}>
          <Card size="sm">
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="h-3 w-28 animate-pulse rounded bg-muted" />
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
      <p className="text-base font-medium">No invoices yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Bill a customer directly, or convert an accepted quote into an invoice.
      </p>
      <Link
        href="/invoices/new"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
      >
        Create your first invoice
      </Link>
    </div>
  );
}

function InvoiceRow({ invoice: inv }: { invoice: InvoiceListRow }) {
  return (
    <li>
      <Link href={`/invoices/${inv.id}`} className="block">
        <Card size="sm" className="transition-colors hover:bg-muted/60">
          <CardContent className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium text-muted-foreground">
                {inv.invoice_number}
              </p>
              <Badge
                variant={PAYMENT_BADGE[inv.payment_status]}
                size="sm"
                className="shrink-0 uppercase"
              >
                {PAYMENT_STATUS_LABELS[inv.payment_status]}
              </Badge>
            </div>
            <p className="truncate text-base font-medium">{inv.customers?.name ?? '—'}</p>
            {inv.project_label && (
              <p className="truncate text-xs text-muted-foreground">{inv.project_label}</p>
            )}
            <div className="flex items-baseline justify-between pt-1 text-xs text-muted-foreground">
              <span>
                {formatDateDMY(inv.issue_date)}
                {Number(inv.amount_due) > 0 && (
                  <>
                    {' · '}due{' '}
                    <span className="text-foreground">{formatINR(inv.amount_due)}</span>
                  </>
                )}
              </span>
              <span className="text-sm font-semibold text-foreground">
                {formatINR(inv.total)}
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </li>
  );
}
