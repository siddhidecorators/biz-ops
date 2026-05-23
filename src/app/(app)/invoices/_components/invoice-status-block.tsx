'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  paymentKeys,
  fetchPayments,
  deriveInvoicePaymentState,
  type PaymentRow,
} from '@/lib/queries/payments';
import {
  PAYMENT_STATUS_LABELS,
  type PaymentStatus,
  type GstType,
} from '@/lib/enums';
import { formatINR, formatDateDMY } from '@/lib/format';
import { cn } from '@/lib/utils';

const PAY_STYLE: Record<PaymentStatus, string> = {
  unpaid: 'bg-rose-500/10 text-rose-700 ring-rose-500/30 dark:text-rose-300',
  partial: 'bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300',
  paid: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
};

type InitialState = {
  amount_paid: number;
  amount_due: number;
  payment_status: PaymentStatus;
};

export function InvoiceStatusPill({
  invoiceId,
  invoiceTotal,
  issueDate,
  gstType,
  initial,
  initialPayments,
}: {
  invoiceId: string;
  invoiceTotal: number;
  issueDate: string;
  gstType: GstType;
  initial: InitialState;
  initialPayments: PaymentRow[];
}) {
  const queryClient = useQueryClient();

  // Seed the payments cache from the server-rendered initial data so the
  // first paint matches what came down on the HTML.
  useEffect(() => {
    queryClient.setQueryData(paymentKeys.list(invoiceId), (existing: PaymentRow[] | undefined) => {
      // Don't clobber a cache that's already been mutated optimistically.
      return existing ?? initialPayments;
    });
  }, [invoiceId, initialPayments, queryClient]);

  const { data: payments } = useQuery({
    queryKey: paymentKeys.list(invoiceId),
    queryFn: () => fetchPayments(invoiceId),
    initialData: initialPayments,
  });

  const derived = payments
    ? deriveInvoicePaymentState(payments, invoiceTotal)
    : initial;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={cn(
          'rounded-full px-2 py-0.5 font-medium uppercase tracking-wide ring-1 transition-colors',
          PAY_STYLE[derived.payment_status],
        )}
      >
        {PAYMENT_STATUS_LABELS[derived.payment_status]}
      </span>
      <span className="text-muted-foreground">
        Issued {formatDateDMY(issueDate)}
        {gstType === 'inter_state' ? ' · IGST' : ' · CGST + SGST'}
      </span>
    </div>
  );
}

export function InvoicePaidDueRows({
  invoiceId,
  invoiceTotal,
  initial,
  initialPayments,
}: {
  invoiceId: string;
  invoiceTotal: number;
  initial: InitialState;
  initialPayments: PaymentRow[];
}) {
  const { data: payments } = useQuery({
    queryKey: paymentKeys.list(invoiceId),
    queryFn: () => fetchPayments(invoiceId),
    initialData: initialPayments,
  });

  const derived = payments
    ? deriveInvoicePaymentState(payments, invoiceTotal)
    : initial;

  if (derived.amount_paid <= 0.0099) return null;

  return (
    <>
      <div className="flex items-baseline justify-between text-muted-foreground">
        <span>Paid</span>
        <span>{formatINR(derived.amount_paid)}</span>
      </div>
      <div className="flex items-baseline justify-between text-base font-semibold">
        <span>Balance due</span>
        <span className="text-primary">{formatINR(derived.amount_due)}</span>
      </div>
    </>
  );
}

export function InvoicePaidInFullBanner({
  invoiceId,
  invoiceTotal,
  initialPayments,
}: {
  invoiceId: string;
  invoiceTotal: number;
  initialPayments: PaymentRow[];
}) {
  const { data: payments } = useQuery({
    queryKey: paymentKeys.list(invoiceId),
    queryFn: () => fetchPayments(invoiceId),
    initialData: initialPayments,
  });

  const derived = deriveInvoicePaymentState(payments ?? [], invoiceTotal);
  if (derived.payment_status !== 'paid' || (payments?.length ?? 0) === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm font-medium text-emerald-700 dark:text-emerald-300">
      ✓ Paid in full
    </div>
  );
}
