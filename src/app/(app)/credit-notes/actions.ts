'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { round2 } from '@/lib/format';

type InvoiceForCredit = {
  id: string;
  org_id: string;
  customer_id: string | null;
  invoice_number: string;
  status: string;
  subtotal: number | string;
  tax_total: number | string;
  cgst_total: number | string;
  sgst_total: number | string;
  igst_total: number | string;
  total: number | string;
  gst_type: 'intra_state' | 'inter_state';
  place_of_supply_state: string | null;
};

export type CreateCreditNoteInput = {
  invoiceId: string;
  mode: 'full' | 'partial';
  reason: string;
  /** Partial only: taxable value being credited. */
  taxable?: number;
  /** Partial only: GST % on that taxable value. */
  gstPercent?: number;
};

export type CreateCreditNoteResult = {
  ok: boolean;
  error?: string;
  creditNoteId?: string;
};

export async function createCreditNote(
  input: CreateCreditNoteInput,
): Promise<CreateCreditNoteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in expired. Reload and try again.' };

  // Invoice fetch is RLS-scoped to the active business, so this can only return
  // an invoice the caller may act on.
  const { data: invoice } = await supabase
    .from('invoices')
    .select(
      'id, org_id, customer_id, invoice_number, status, subtotal, tax_total, cgst_total, sgst_total, igst_total, total, gst_type, place_of_supply_state',
    )
    .eq('id', input.invoiceId)
    .maybeSingle<InvoiceForCredit>();
  if (!invoice) return { ok: false, error: 'Invoice not found.' };

  const reason = input.reason.trim() || null;
  const isIntra = invoice.gst_type === 'intra_state';

  let subtotal: number;
  let taxTotal: number;
  let cgst: number;
  let sgst: number;
  let igst: number;
  let total: number;

  if (input.mode === 'full') {
    if (invoice.status === 'cancelled') {
      return { ok: false, error: 'This invoice is already cancelled.' };
    }
    subtotal = round2(Number(invoice.subtotal));
    taxTotal = round2(Number(invoice.tax_total));
    cgst = round2(Number(invoice.cgst_total));
    sgst = round2(Number(invoice.sgst_total));
    igst = round2(Number(invoice.igst_total));
    total = round2(Number(invoice.total));
  } else {
    const taxable = round2(Number(input.taxable ?? 0));
    const pct = Number(input.gstPercent ?? 0);
    if (!(taxable > 0)) return { ok: false, error: 'Enter a taxable amount to credit.' };
    if (taxable > round2(Number(invoice.subtotal)) + 0.5) {
      return { ok: false, error: "You can't credit more than the invoice's taxable value." };
    }
    if (!(pct >= 0 && pct <= 100)) return { ok: false, error: 'GST % must be between 0 and 100.' };
    subtotal = taxable;
    taxTotal = round2((taxable * pct) / 100);
    cgst = isIntra ? round2(taxTotal / 2) : 0;
    sgst = cgst;
    igst = isIntra ? 0 : taxTotal;
    total = round2(subtotal + taxTotal);
  }

  const { data: cnNumber, error: rpcErr } = await supabase.rpc('next_credit_note_number', {
    p_org_id: invoice.org_id,
  });
  if (rpcErr || !cnNumber) {
    return { ok: false, error: rpcErr?.message ?? 'Could not generate a credit note number.' };
  }

  const { data: creditNote, error: insertErr } = await supabase
    .from('credit_notes')
    .insert({
      org_id: invoice.org_id,
      invoice_id: invoice.id,
      customer_id: invoice.customer_id,
      credit_note_number: cnNumber as string,
      reason,
      subtotal,
      tax_total: taxTotal,
      round_off: 0,
      total,
      place_of_supply_state: invoice.place_of_supply_state,
      gst_type: invoice.gst_type,
      cgst_total: cgst,
      sgst_total: sgst,
      igst_total: igst,
      created_by: user.id,
    })
    .select('id')
    .single<{ id: string }>();
  if (insertErr || !creditNote) {
    return { ok: false, error: insertErr?.message ?? 'Could not create the credit note.' };
  }

  if (input.mode === 'full') {
    const { error: cancelErr } = await supabase
      .from('invoices')
      .update({ status: 'cancelled' })
      .eq('id', invoice.id);
    if (cancelErr) {
      // The credit note exists; surface the issue but don't roll back the record.
      return { ok: false, error: `Credit note created, but couldn't cancel the invoice: ${cancelErr.message}` };
    }
  }

  revalidatePath('/invoices');
  revalidatePath(`/invoices/${invoice.id}`);
  revalidatePath(`/credit-notes/${creditNote.id}`);
  return { ok: true, creditNoteId: creditNote.id };
}
