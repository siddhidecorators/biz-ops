import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PlusIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { QUOTE_STATUS_LABELS, type QuoteStatus } from '@/lib/enums';
import { formatINR, formatDateDMY } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AppBar } from '../_components/app-bar';

export const metadata = { title: 'Quotes' };

type QuoteListRow = {
  id: string;
  quote_number: string;
  status: QuoteStatus;
  issue_date: string;
  valid_until: string;
  total: number | string;
  project_label: string | null;
  customers: { name: string } | null;
};

const STATUS_STYLE: Record<QuoteStatus, string> = {
  draft: 'bg-muted text-muted-foreground ring-border',
  sent: 'bg-sky-500/10 text-sky-700 ring-sky-500/30 dark:text-sky-300',
  accepted: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
  declined: 'bg-rose-500/10 text-rose-700 ring-rose-500/30 dark:text-rose-300',
  converted_to_invoice: 'bg-brand-tint text-primary ring-primary/30',
  expired: 'bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300',
};

export default async function QuotesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: quotes, error } = await supabase
    .from('quotes')
    .select(
      'id, quote_number, status, issue_date, valid_until, total, project_label, customers(name)',
    )
    .order('issue_date', { ascending: false })
    .order('quote_number', { ascending: false })
    .returns<QuoteListRow[]>();

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
        {error ? (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error.message}
          </p>
        ) : total === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-2.5">
            {quotes!.map((q) => (
              <li key={q.id}>
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
                      <p className="truncate text-base font-medium">
                        {q.customers?.name ?? '—'}
                      </p>
                      {q.project_label && (
                        <p className="truncate text-xs text-muted-foreground">
                          {q.project_label}
                        </p>
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
            ))}
          </ul>
        )}
      </main>
    </>
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
