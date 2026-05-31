'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { UNITS } from '@/lib/enums';
import { resolveAmounts, validatePlan } from '@/lib/milestones';

const lineSchema = z.object({
  template_id: z.string().uuid().nullable().optional(),
  description: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1, 'Description is required')),
  hsn_sac_code: z.string().optional().transform((v) => v?.trim() ?? ''),
  unit: z.enum(UNITS),
  quantity: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .pipe(z.number().positive('Quantity must be more than zero')),
  rate: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .pipe(z.number().nonnegative('Rate cannot be negative')),
  tax_rate_percent: z
    .union([z.string(), z.number()])
    .transform((v) => (v === '' || v == null ? 0 : Number(v)))
    .pipe(
      z.number().nonnegative('Tax rate cannot be negative').max(100, 'Tax rate must be 0–100'),
    ),
});

const milestoneSchema = z.object({
  label: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1, 'Each installment needs a label')),
  percent: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => (v === null || v === undefined || v === '' ? null : Number(v))),
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .pipe(z.number().nonnegative()),
  due_date: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
});

const trimmed = z.string().optional().transform((v) => v?.trim() ?? '');

const schema = z.object({
  customer_id: z.string().uuid('Pick a customer'),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date'),
  project_label: trimmed,
  notes: trimmed,
  lines: z
    .string()
    .transform((v, ctx) => {
      try {
        return JSON.parse(v);
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Lines payload is malformed' });
        return z.NEVER;
      }
    })
    .pipe(z.array(lineSchema).min(1, 'Add at least one line item')),
  milestones: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return [];
      try {
        return JSON.parse(v) as unknown[];
      } catch {
        return [];
      }
    })
    .pipe(z.array(milestoneSchema)),
});

export type InvoiceFormState = {
  ok: boolean;
  fieldErrors?: Partial<Record<keyof z.input<typeof schema>, string>>;
  lineErrors?: Array<Partial<Record<keyof z.input<typeof lineSchema>, string>>>;
  formError?: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function totalsOf(lines: z.output<typeof lineSchema>[]) {
  let subtotal = 0;
  let tax_total = 0;
  for (const l of lines) {
    const amount = round2(l.quantity * l.rate);
    const tax = round2((amount * l.tax_rate_percent) / 100);
    subtotal += amount;
    tax_total += tax;
  }
  subtotal = round2(subtotal);
  tax_total = round2(tax_total);
  const gross = round2(subtotal + tax_total);
  const total = Math.round(gross);
  const round_off = round2(total - gross);
  return { subtotal, tax_total, round_off, total };
}

export async function createInvoice(
  _prev: InvoiceFormState | null,
  formData: FormData,
): Promise<InvoiceFormState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: InvoiceFormState['fieldErrors'] = {};
    const lineErrors: InvoiceFormState['lineErrors'] = [];
    for (const issue of parsed.error.issues) {
      const [first, ...rest] = issue.path;
      if (first === 'lines' && typeof rest[0] === 'number') {
        const idx = rest[0];
        const fieldName = rest[1] as keyof z.input<typeof lineSchema> | undefined;
        if (!lineErrors[idx]) lineErrors[idx] = {};
        if (fieldName) lineErrors[idx]![fieldName] = issue.message;
      } else if (typeof first === 'string') {
        const key = first as keyof z.input<typeof schema>;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
    }
    return { ok: false, fieldErrors, lineErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, formError: 'Sign in expired. Reload and try again.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, active_org_id')
    .eq('id', user.id)
    .maybeSingle<{ org_id: string | null; active_org_id: string | null }>();
  if (!profile) {
    return { ok: false, formError: 'Profile missing — try signing out and back in.' };
  }

  const orgId = profile.active_org_id ?? profile.org_id;
  if (!orgId) return { ok: false, formError: 'No active business.' };

  const v = parsed.data;
  const totals = totalsOf(v.lines);

  // Resolve the optional payment schedule against the real (server) total so
  // the installments always tie out exactly, then validate the plan.
  let milestoneRows: { label: string; percent: number | null; amount: number; due_date: string | null }[] = [];
  if (v.milestones.length > 0) {
    milestoneRows = resolveAmounts(
      v.milestones.map((m) => ({
        label: m.label,
        percent: m.percent,
        amount: m.amount,
        due_date: m.due_date,
      })),
      totals.total,
    );
    const planErr = validatePlan(milestoneRows, totals.total);
    if (planErr) return { ok: false, formError: planErr };
  }

  // GST treatment: intra-state (CGST+SGST) when the customer's place of supply
  // matches the org's state, else inter-state (IGST). Mirrors the quote→invoice
  // conversion so a direct invoice is taxed identically.
  const [{ data: customer }, { data: org }] = await Promise.all([
    supabase
      .from('customers')
      .select('billing_state')
      .eq('id', v.customer_id)
      .maybeSingle<{ billing_state: string | null }>(),
    supabase
      .from('orgs')
      .select('state, terms_text')
      .eq('id', orgId)
      .maybeSingle<{ state: string | null; terms_text: string | null }>(),
  ]);

  const placeOfSupply = customer?.billing_state ?? org?.state ?? null;
  const isIntraState = !!org?.state && !!placeOfSupply && org.state === placeOfSupply;
  const gstType = isIntraState ? 'intra_state' : 'inter_state';
  const cgstTotal = isIntraState ? round2(totals.tax_total / 2) : 0;
  const sgstTotal = cgstTotal;
  const igstTotal = isIntraState ? 0 : totals.tax_total;

  const { data: invNumber, error: rpcErr } = await supabase.rpc('next_invoice_number', {
    p_org_id: orgId,
  });
  if (rpcErr || !invNumber) {
    return { ok: false, formError: rpcErr?.message ?? 'Could not generate invoice number' };
  }

  const { data: invoice, error: insertErr } = await supabase
    .from('invoices')
    .insert({
      org_id: orgId,
      invoice_number: invNumber as string,
      customer_id: v.customer_id,
      issue_date: v.issue_date,
      status: 'issued',
      payment_status: 'unpaid',
      project_label: v.project_label || null,
      subtotal: totals.subtotal,
      tax_total: totals.tax_total,
      round_off: totals.round_off,
      total: totals.total,
      amount_paid: 0,
      amount_due: totals.total,
      place_of_supply_state: placeOfSupply,
      gst_type: gstType,
      cgst_total: cgstTotal,
      sgst_total: sgstTotal,
      igst_total: igstTotal,
      notes: v.notes || null,
      terms_text: org?.terms_text ?? null,
      created_by: user.id,
    })
    .select('id')
    .single<{ id: string }>();

  if (insertErr || !invoice) {
    return { ok: false, formError: insertErr?.message ?? 'Could not create invoice' };
  }

  const lineRows = v.lines.map((l, i) => {
    const amount = round2(l.quantity * l.rate);
    const taxAmt = round2((amount * l.tax_rate_percent) / 100);
    return {
      invoice_id: invoice.id,
      template_id: l.template_id || null,
      description: l.description,
      hsn_sac_code: l.hsn_sac_code || null,
      unit: l.unit,
      quantity: l.quantity,
      rate: l.rate,
      tax_rate_percent: l.tax_rate_percent,
      cgst_amount: isIntraState ? round2(taxAmt / 2) : 0,
      sgst_amount: isIntraState ? round2(taxAmt / 2) : 0,
      igst_amount: isIntraState ? 0 : taxAmt,
      sort_order: i,
    };
  });

  const { error: linesErr } = await supabase.from('invoice_lines').insert(lineRows);
  if (linesErr) {
    // Roll back so we don't leave an empty invoice behind
    await supabase.from('invoices').delete().eq('id', invoice.id);
    return { ok: false, formError: `Couldn't save line items: ${linesErr.message}` };
  }

  if (milestoneRows.length > 0) {
    const { error: msErr } = await supabase.from('invoice_milestones').insert(
      milestoneRows.map((m, i) => ({
        invoice_id: invoice.id,
        label: m.label,
        percent: m.percent,
        amount: m.amount,
        due_date: m.due_date,
        sort_order: i,
      })),
    );
    if (msErr) {
      // Deleting the invoice cascades to its lines + milestones.
      await supabase.from('invoices').delete().eq('id', invoice.id);
      return { ok: false, formError: `Couldn't save the payment plan: ${msErr.message}` };
    }
  }

  revalidatePath('/invoices');
  redirect(`/invoices/${invoice.id}?saved=invoice_created`);
}

// Replace an invoice's payment schedule wholesale. Called from the Edit-plan
// dialog on the detail page (so quote-converted invoices can get a plan too).
// Passing an empty array clears the schedule (back to a single balance).
export async function setInvoiceSchedule(
  invoiceId: string,
  milestones: { label: string; percent: number | null; amount: number; due_date: string | null }[],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in expired. Reload and try again.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, active_org_id')
    .eq('id', user.id)
    .maybeSingle<{ org_id: string | null; active_org_id: string | null }>();
  if (!profile) return { ok: false, error: 'Profile missing — sign out and back in.' };

  // Verify the invoice is in the caller's org (defense in depth beyond RLS) and
  // read its total so the schedule resolves against the real figure.
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, org_id, total')
    .eq('id', invoiceId)
    .maybeSingle<{ id: string; org_id: string; total: number | string }>();
  const orgId = profile.active_org_id ?? profile.org_id;
  if (!invoice || invoice.org_id !== orgId) {
    return { ok: false, error: 'Invoice not found.' };
  }

  const total = Number(invoice.total);
  let rows: { label: string; percent: number | null; amount: number; due_date: string | null }[] = [];
  if (milestones.length > 0) {
    rows = resolveAmounts(milestones, total);
    const planErr = validatePlan(rows, total);
    if (planErr) return { ok: false, error: planErr };
  }

  const { error: delErr } = await supabase
    .from('invoice_milestones')
    .delete()
    .eq('invoice_id', invoiceId);
  if (delErr) return { ok: false, error: delErr.message };

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from('invoice_milestones').insert(
      rows.map((m, i) => ({
        invoice_id: invoiceId,
        label: m.label,
        percent: m.percent,
        amount: m.amount,
        due_date: m.due_date,
        sort_order: i,
      })),
    );
    if (insErr) return { ok: false, error: insErr.message };
  }

  revalidatePath(`/invoices/${invoiceId}`);
  return { ok: true };
}
