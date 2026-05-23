import { createClient } from '@/lib/supabase/browser';
import type { PaymentMode, PaymentStatus } from '@/lib/enums';

export type PaymentRow = {
  id: string;
  amount: number | string;
  payment_date: string;
  mode: PaymentMode;
  reference: string | null;
  notes: string | null;
};

export const paymentKeys = {
  all: ['payments'] as const,
  lists: () => [...paymentKeys.all, 'list'] as const,
  list: (invoiceId: string) => [...paymentKeys.lists(), invoiceId] as const,
};

export async function fetchPayments(invoiceId: string): Promise<PaymentRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('payments')
    .select('id, amount, payment_date, mode, reference, notes')
    .eq('invoice_id', invoiceId)
    .order('payment_date', { ascending: false })
    .returns<PaymentRow[]>();
  if (error) throw error;
  return data ?? [];
}

// Recomputes the same derived numbers that the recalc_invoice_payment_status
// DB trigger would write back. Used client-side so the UI can reflect new
// status the instant a payment is optimistically added.
export function deriveInvoicePaymentState(
  payments: ReadonlyArray<{ amount: number | string }>,
  invoiceTotal: number,
): { amount_paid: number; amount_due: number; payment_status: PaymentStatus } {
  const amount_paid = round2(
    payments.reduce((sum, p) => sum + Number(p.amount), 0),
  );
  const amount_due = round2(invoiceTotal - amount_paid);
  // 1 paise tolerance to match server-side recordPayment's overpayment guard.
  const payment_status: PaymentStatus =
    amount_paid <= 0.0099
      ? 'unpaid'
      : amount_due <= 0.0099
        ? 'paid'
        : 'partial';
  return { amount_paid, amount_due, payment_status };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
