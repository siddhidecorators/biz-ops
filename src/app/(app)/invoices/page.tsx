import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { PAYMENT_STATUS_LABELS, type PaymentStatus, type InvoiceStatus } from '@/lib/enums';
import { formatINR, formatDateDMY } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AppBar } from '../_components/app-bar';

export const metadata = { title: 'Invoices' };

type InvoiceListRow = {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  payment_status: PaymentStatus;
  issue_date: string;
  total: number | string;
  amount_due: number | string;
  project_label: string | null;
  customers: { name: string } | null;
};

const PAY_STYLE: Record<PaymentStatus, string> = {
  unpaid: 'bg-rose-500/10 text-rose-700 ring-rose-500/30 dark:text-rose-300',
  partial: 'bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300',
  paid: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
};

export default async function InvoicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select(
      'id, invoice_number, status, payment_status, issue_date, total, amount_due, project_label, customers(name)',
    )
    .order('issue_date', { ascending: false })
    .order('invoice_number', { ascending: false })
    .returns<InvoiceListRow[]>();

  const total = invoices?.length ?? 0;

  return (
    <>
      <AppBar
        title="Invoices"
        subtitle={total > 0 ? `${total} total` : undefined}
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
            {invoices!.map((inv) => (
              <li key={inv.id}>
                <Link href={`/invoices/${inv.id}`} className="block">
                  <Card size="sm" className="transition-colors hover:bg-muted/60">
                    <CardContent className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-muted-foreground">
                          {inv.invoice_number}
                        </p>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1',
                            PAY_STYLE[inv.payment_status],
                          )}
                        >
                          {PAYMENT_STATUS_LABELS[inv.payment_status]}
                        </span>
                      </div>
                      <p className="truncate text-base font-medium">
                        {inv.customers?.name ?? '—'}
                      </p>
                      {inv.project_label && (
                        <p className="truncate text-xs text-muted-foreground">
                          {inv.project_label}
                        </p>
                      )}
                      <div className="flex items-baseline justify-between pt-1 text-xs text-muted-foreground">
                        <span>
                          {formatDateDMY(inv.issue_date)}
                          {Number(inv.amount_due) > 0 && (
                            <>
                              {' · '}due{' '}
                              <span className="text-foreground">
                                {formatINR(inv.amount_due)}
                              </span>
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
      <p className="text-base font-medium">No invoices yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Invoices appear here once you convert an accepted quote.
      </p>
      <Link
        href="/quotes"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-lg border border-border bg-card px-5 text-sm font-medium"
      >
        Go to quotes
      </Link>
    </div>
  );
}
