'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { PAYMENT_MODES } from '@/lib/enums';

const trimmed = z.string().optional().transform((v) => v?.trim() ?? '');

const schema = z.object({
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'string' ? v.trim() : String(v)))
    .refine((v) => v !== '' && /^\d+(\.\d{1,2})?$/.test(v), 'Enter a valid amount')
    .transform((v) => Number(v))
    .pipe(z.number().positive('Amount must be more than zero')),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date'),
  mode: z.enum(PAYMENT_MODES),
  reference: trimmed,
  notes: trimmed,
});

export type PaymentFormState = {
  ok: boolean;
  fieldErrors?: Partial<Record<keyof z.input<typeof schema>, string>>;
  formError?: string;
};

export async function recordPayment(
  invoiceId: string,
  _prev: PaymentFormState | null,
  formData: FormData,
): Promise<PaymentFormState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: PaymentFormState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof z.input<typeof schema>;
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, formError: 'Sign in expired. Reload and try again.' };

  // Read current balance so we can refuse over-payment cleanly. RLS scopes
  // this to the user's org automatically.
  const { data: invoice } = await supabase
    .from('invoices')
    .select('amount_due, total')
    .eq('id', invoiceId)
    .maybeSingle<{ amount_due: number | string; total: number | string }>();
  if (!invoice) return { ok: false, formError: 'Invoice not found.' };

  const v = parsed.data;
  const amountDue = Number(invoice.amount_due);
  // Allow a 1 paise tolerance to avoid floating-point friction on exact-balance payments
  if (v.amount > amountDue + 0.01) {
    return {
      ok: false,
      fieldErrors: {
        amount: `Amount can't exceed balance due (${amountDue.toFixed(2)}).`,
      },
    };
  }

  const { error } = await supabase.from('payments').insert({
    invoice_id: invoiceId,
    amount: v.amount,
    payment_date: v.payment_date,
    mode: v.mode,
    reference: v.reference || null,
    notes: v.notes || null,
    created_by: user.id,
  });
  if (error) return { ok: false, formError: error.message };

  // The recalc_invoice_payment_status trigger updates the parent invoice's
  // amount_paid, amount_due, and payment_status atomically.
  revalidatePath('/invoices');
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}?saved=payment_recorded`);
}

export type DeletePaymentState = { ok: boolean; formError?: string };

export async function deletePayment(
  paymentId: string,
  invoiceId: string,
  _prev: DeletePaymentState | null,
): Promise<DeletePaymentState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, formError: 'Sign in expired.' };

  const { error } = await supabase.from('payments').delete().eq('id', paymentId);
  if (error) return { ok: false, formError: error.message };

  revalidatePath('/invoices');
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}?saved=payment_deleted`);
}
