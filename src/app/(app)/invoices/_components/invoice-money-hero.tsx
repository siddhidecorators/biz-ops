'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Confetti, SuccessCheck } from '@/components/celebration';
import { formatINR, formatDateDMY } from '@/lib/format';
import { useTween } from '@/lib/use-count-up';
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
import { RecordPaymentDialog } from './record-payment-dialog';
import { ShareButton } from '../../quotes/_components/share-button';
import type { QuotePdfData } from '../../quotes/_components/quote-pdf';

const groupINR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

const PAY_VARIANT: Record<PaymentStatus, 'danger' | 'warning' | 'success'> = {
  unpaid: 'danger',
  partial: 'warning',
  paid: 'success',
};

// Shared derive: every payment component reads the same cache key, so this
// stays in lockstep with optimistic record/delete elsewhere on the page.
function useDerivedState(
  invoiceId: string,
  invoiceTotal: number,
  initialPayments: PaymentRow[],
) {
  const { data: payments = initialPayments } = useQuery({
    queryKey: paymentKeys.list(invoiceId),
    queryFn: () => fetchPayments(invoiceId),
    initialData: initialPayments,
  });
  return deriveInvoicePaymentState(payments, invoiceTotal);
}

function splitMoney(value: number): { rupees: number; paise: string } {
  let rupees = Math.floor(value);
  let paise = Math.round((value - rupees) * 100);
  if (paise === 100) {
    rupees += 1;
    paise = 0;
  }
  return { rupees, paise: String(paise).padStart(2, '0') };
}

export function InvoiceMoneyHero({
  invoiceId,
  invoiceTotal,
  issueDate,
  gstType,
  initialPayments,
}: {
  invoiceId: string;
  invoiceTotal: number;
  issueDate: string;
  gstType: GstType;
  initialPayments: PaymentRow[];
}) {
  const { amount_paid, amount_due, payment_status } = useDerivedState(
    invoiceId,
    invoiceTotal,
    initialPayments,
  );
  const isPaid = payment_status === 'paid';

  const tweenedDue = useTween(amount_due);

  // Progress fill animates in on mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const pct =
    invoiceTotal > 0
      ? Math.min(100, Math.max(0, (amount_paid / invoiceTotal) * 100))
      : 0;

  // Celebrate only when the balance clears *after* mount (a fresh win — not when
  // landing on an already-paid invoice).
  const [celebrate, setCelebrate] = useState(false);
  const wasPaid = useRef(isPaid);
  useEffect(() => {
    if (isPaid && !wasPaid.current) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 1500);
      wasPaid.current = isPaid;
      return () => clearTimeout(t);
    }
    wasPaid.current = isPaid;
  }, [isPaid]);

  if (isPaid) {
    return (
      <div className="animate-rise relative rounded-2xl border border-success/25 bg-success-tint px-5 py-6 text-center">
        {celebrate && <Confetti />}
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-success/15 text-success-strong">
          <SuccessCheck className="size-8" />
        </span>
        <p className="mt-3 font-heading text-xl text-success-strong">Paid in full</p>
        <p className="mt-0.5 text-sm text-success-strong/80">
          {formatINR(invoiceTotal)} received — thank you
        </p>
      </div>
    );
  }

  const { rupees, paise } = splitMoney(Math.max(0, tweenedDue));

  return (
    <div className="animate-rise relative overflow-hidden rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.06]">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={PAY_VARIANT[payment_status]} className="uppercase">
          {PAYMENT_STATUS_LABELS[payment_status]}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Issued {formatDateDMY(issueDate)}
          {gstType === 'inter_state' ? ' · IGST' : ' · CGST + SGST'}
        </span>
      </div>

      <p className="text-overline mt-4">Balance due</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-xl font-semibold text-muted-foreground">₹</span>
        <span className="tabular font-heading text-[2.4rem] leading-none tracking-tight text-primary">
          {groupINR.format(rupees)}
        </span>
        <span className="text-base font-semibold text-muted-foreground">.{paise}</span>
      </div>

      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="ease-out-expo h-full rounded-full bg-success transition-[width] duration-700"
            style={{ width: mounted ? `${pct}%` : '0%' }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{formatINR(amount_paid)}</span> collected
          </span>
          <span>of {formatINR(invoiceTotal)}</span>
        </div>
      </div>
    </div>
  );
}

export function InvoiceActions({
  invoiceId,
  invoiceTotal,
  invoiceNumber,
  shareToken,
  customerName,
  orgName,
  pdfData,
  initialPayments,
}: {
  invoiceId: string;
  invoiceTotal: number;
  invoiceNumber: string;
  shareToken: string;
  customerName: string | null;
  orgName: string | null;
  pdfData: QuotePdfData | null;
  initialPayments: PaymentRow[];
}) {
  const { amount_due } = useDerivedState(invoiceId, invoiceTotal, initialPayments);
  if (amount_due <= 0.0099) return null;

  return (
    <div className="space-y-3">
      <RecordPaymentDialog
        invoiceId={invoiceId}
        invoiceTotal={invoiceTotal}
        invoiceNumber={invoiceNumber}
      />
      {pdfData && orgName && (
        <ShareButton
          data={pdfData}
          token={shareToken}
          kind="i"
          message={`Hi ${customerName ?? 'there'}, a gentle reminder for invoice ${invoiceNumber} from ${orgName} — ${formatINR(
            amount_due,
          )} due. View & pay:`}
          label="Share invoice"
          fileName={`${invoiceNumber.replace(/[/\\]/g, '_')}.pdf`}
        />
      )}
    </div>
  );
}
