'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { MessageCircleIcon, LinkIcon, CheckIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatINR, formatDateDMY } from '@/lib/format';
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from '@/lib/enums';
import {
  statementKeys,
  fetchCustomerInvoices,
  totalDue,
  type StatementInvoice,
} from '@/lib/queries/statements';

const PAY_STYLE: Record<PaymentStatus, string> = {
  unpaid: 'bg-rose-500/10 text-rose-700 ring-rose-500/30 dark:text-rose-300',
  partial: 'bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300',
  paid: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
};

function waNumber(phone: string | null): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = '91' + d;
  return d.length >= 11 ? d : null;
}

export function StatementView({
  customerId,
  customerName,
  customerPhone,
  shareToken,
  orgName,
}: {
  customerId: string;
  customerName: string;
  customerPhone: string;
  shareToken: string;
  orgName: string;
}) {
  const [copied, setCopied] = useState(false);

  const { data: invoices, isPending, isError } = useQuery({
    queryKey: statementKeys.forCustomer(customerId),
    queryFn: () => fetchCustomerInvoices(customerId),
  });

  const list = invoices ?? [];
  const due = totalDue(list);

  function statementLink() {
    return `${window.location.origin}/s/${shareToken}`;
  }

  function sendWhatsApp() {
    const link = statementLink();
    const msg =
      due > 0
        ? `Hi ${customerName}, here's your account statement from ${orgName}. Total outstanding: ${formatINR(
            due,
          )}. View & pay here: ${link}`
        : `Hi ${customerName}, here's your account statement from ${orgName}: ${link}`;
    const num = waNumber(customerPhone);
    const url = num
      ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(statementLink());
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the link.');
    }
  }

  return (
    <main className="mx-auto max-w-md space-y-4 px-6 py-5">
      {/* Outstanding banner */}
      <Card className={cn(due > 0 ? 'bg-brand-tint/40' : 'bg-emerald-500/5')}>
        <CardContent className="py-5 text-center">
          {due > 0 ? (
            <>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Total outstanding
              </p>
              <p className="mt-1 text-3xl font-bold text-primary">{formatINR(due)}</p>
            </>
          ) : (
            <p className="text-base font-semibold text-emerald-700">✓ No dues — all settled</p>
          )}
        </CardContent>
      </Card>

      {/* Share */}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button
          type="button"
          size="lg"
          className="h-12 w-full bg-[#25D366] text-white hover:bg-[#25D366]/90"
          onClick={sendWhatsApp}
        >
          <MessageCircleIcon className="size-4" />
          Send statement on WhatsApp
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="h-12"
          aria-label="Copy statement link"
          onClick={copyLink}
        >
          {copied ? <CheckIcon className="size-4" /> : <LinkIcon className="size-4" />}
        </Button>
      </div>

      {/* Invoice list */}
      {isError ? (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          Could not load the statement.
        </p>
      ) : isPending ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">No invoices for this customer yet.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {list.map((inv) => (
            <StatementRow key={inv.id} invoice={inv} />
          ))}
        </ul>
      )}
    </main>
  );
}

function StatementRow({ invoice: inv }: { invoice: StatementInvoice }) {
  return (
    <li>
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
            <div className="flex items-baseline justify-between pt-0.5 text-xs text-muted-foreground">
              <span>{formatDateDMY(inv.issue_date)}</span>
              <span>
                {formatINR(inv.total)}
                {Number(inv.amount_due) > 0 && (
                  <span className="ml-2 font-semibold text-primary">
                    {formatINR(inv.amount_due)} due
                  </span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </li>
  );
}
