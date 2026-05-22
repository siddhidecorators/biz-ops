'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { UNITS, QUOTE_STATUSES, type QuoteStatus } from '@/lib/enums';

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
      z
        .number()
        .nonnegative('Tax rate cannot be negative')
        .max(100, 'Tax rate must be 0–100'),
    ),
});

const trimmed = z.string().optional().transform((v) => v?.trim() ?? '');

const schema = z.object({
  customer_id: z.string().uuid('Pick a customer'),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date'),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date'),
  project_label: trimmed,
  install_address_line1: trimmed,
  install_address_line2: trimmed,
  install_city: trimmed,
  install_state: trimmed,
  install_pincode: trimmed,
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
});

export type QuoteFormState = {
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

export async function createQuote(
  _prev: QuoteFormState | null,
  formData: FormData,
): Promise<QuoteFormState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: QuoteFormState['fieldErrors'] = {};
    const lineErrors: QuoteFormState['lineErrors'] = [];
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
    .select('org_id')
    .eq('id', user.id)
    .maybeSingle<{ org_id: string }>();
  if (!profile) {
    return { ok: false, formError: 'Profile missing — try signing out and back in.' };
  }

  const v = parsed.data;
  const totals = totalsOf(v.lines);

  // Atomic per-org quote number from the next_quote_number Postgres function
  const { data: quoteNumberData, error: rpcErr } = await supabase.rpc('next_quote_number', {
    p_org_id: profile.org_id,
  });
  if (rpcErr || !quoteNumberData) {
    return {
      ok: false,
      formError: rpcErr?.message ?? 'Could not generate quote number',
    };
  }

  // Look up the customer's place of supply (their billing state) for GST treatment.
  // We only persist it on the quote; CGST/SGST/IGST split is computed at invoice time.
  const { data: customer } = await supabase
    .from('customers')
    .select('billing_state')
    .eq('id', v.customer_id)
    .maybeSingle<{ billing_state: string | null }>();
  const placeOfSupply = v.install_state || customer?.billing_state || null;

  const { data: inserted, error: insertErr } = await supabase
    .from('quotes')
    .insert({
      org_id: profile.org_id,
      quote_number: quoteNumberData as string,
      customer_id: v.customer_id,
      issue_date: v.issue_date,
      valid_until: v.valid_until,
      status: 'draft',
      install_address_line1: v.install_address_line1 || null,
      install_address_line2: v.install_address_line2 || null,
      install_city: v.install_city || null,
      install_state: v.install_state || null,
      install_pincode: v.install_pincode || null,
      project_label: v.project_label || null,
      subtotal: totals.subtotal,
      tax_total: totals.tax_total,
      round_off: totals.round_off,
      total: totals.total,
      place_of_supply_state: placeOfSupply,
      notes: v.notes || null,
      created_by: user.id,
    })
    .select('id')
    .single<{ id: string }>();

  if (insertErr || !inserted) {
    return { ok: false, formError: insertErr?.message ?? 'Could not save quote' };
  }

  const lineRows = v.lines.map((l, i) => ({
    quote_id: inserted.id,
    template_id: l.template_id || null,
    description: l.description,
    hsn_sac_code: l.hsn_sac_code || null,
    unit: l.unit,
    quantity: l.quantity,
    rate: l.rate,
    tax_rate_percent: l.tax_rate_percent,
    sort_order: i,
  }));

  const { error: linesErr } = await supabase.from('quote_lines').insert(lineRows);
  if (linesErr) {
    // Roll back the quote so we don't end up with an empty one
    await supabase.from('quotes').delete().eq('id', inserted.id);
    return { ok: false, formError: `Couldn't save line items: ${linesErr.message}` };
  }

  revalidatePath('/quotes');
  redirect(`/quotes/${inserted.id}?saved=quote_created`);
}

export type DeleteQuoteState = { ok: boolean; formError?: string };

export async function deleteQuote(
  id: string,
  _prev: DeleteQuoteState | null,
): Promise<DeleteQuoteState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, formError: 'Sign in expired.' };

  // Quote lines cascade-delete via FK on delete cascade
  const { error } = await supabase.from('quotes').delete().eq('id', id);
  if (error) return { ok: false, formError: error.message };

  revalidatePath('/quotes');
  redirect('/quotes?saved=quote_deleted');
}

export async function updateQuote(
  id: string,
  _prev: QuoteFormState | null,
  formData: FormData,
): Promise<QuoteFormState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: QuoteFormState['fieldErrors'] = {};
    const lineErrors: QuoteFormState['lineErrors'] = [];
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
  if (!user) return { ok: false, formError: 'Sign in expired.' };

  // Refuse updates on quotes already converted to an invoice
  const { data: existing } = await supabase
    .from('quotes')
    .select('status')
    .eq('id', id)
    .maybeSingle<{ status: QuoteStatus }>();
  if (!existing) return { ok: false, formError: 'Quote not found.' };
  if (existing.status === 'converted_to_invoice') {
    return {
      ok: false,
      formError: 'This quote was already converted to an invoice — edit the invoice instead.',
    };
  }

  const v = parsed.data;
  const totals = totalsOf(v.lines);

  const { data: customer } = await supabase
    .from('customers')
    .select('billing_state')
    .eq('id', v.customer_id)
    .maybeSingle<{ billing_state: string | null }>();
  const placeOfSupply = v.install_state || customer?.billing_state || null;

  const { error: updErr } = await supabase
    .from('quotes')
    .update({
      customer_id: v.customer_id,
      issue_date: v.issue_date,
      valid_until: v.valid_until,
      install_address_line1: v.install_address_line1 || null,
      install_address_line2: v.install_address_line2 || null,
      install_city: v.install_city || null,
      install_state: v.install_state || null,
      install_pincode: v.install_pincode || null,
      project_label: v.project_label || null,
      subtotal: totals.subtotal,
      tax_total: totals.tax_total,
      round_off: totals.round_off,
      total: totals.total,
      place_of_supply_state: placeOfSupply,
      notes: v.notes || null,
    })
    .eq('id', id);
  if (updErr) return { ok: false, formError: updErr.message };

  // Replace line items: delete-then-insert is atomic enough for Phase 1
  await supabase.from('quote_lines').delete().eq('quote_id', id);
  const lineRows = v.lines.map((l, i) => ({
    quote_id: id,
    template_id: l.template_id || null,
    description: l.description,
    hsn_sac_code: l.hsn_sac_code || null,
    unit: l.unit,
    quantity: l.quantity,
    rate: l.rate,
    tax_rate_percent: l.tax_rate_percent,
    sort_order: i,
  }));
  const { error: linesErr } = await supabase.from('quote_lines').insert(lineRows);
  if (linesErr) {
    return { ok: false, formError: `Couldn't save line items: ${linesErr.message}` };
  }

  revalidatePath('/quotes');
  revalidatePath(`/quotes/${id}`);
  redirect(`/quotes/${id}?saved=quote_updated`);
}

export type StatusActionState = { ok: boolean; formError?: string };

const STATUS_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ['sent'],
  sent: ['accepted', 'declined', 'draft'],
  accepted: ['converted_to_invoice', 'declined'],
  declined: ['sent', 'draft'],
  converted_to_invoice: [],
  expired: ['sent', 'draft'],
};

export async function setQuoteStatus(
  id: string,
  nextStatus: QuoteStatus,
): Promise<StatusActionState> {
  if (!QUOTE_STATUSES.includes(nextStatus)) {
    return { ok: false, formError: 'Invalid status' };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, formError: 'Sign in expired.' };

  const { data: existing } = await supabase
    .from('quotes')
    .select('status')
    .eq('id', id)
    .maybeSingle<{ status: QuoteStatus }>();
  if (!existing) return { ok: false, formError: 'Quote not found.' };

  const allowed = STATUS_TRANSITIONS[existing.status] ?? [];
  if (!allowed.includes(nextStatus)) {
    return {
      ok: false,
      formError: `Can't move from ${existing.status} to ${nextStatus}.`,
    };
  }

  const { error } = await supabase.from('quotes').update({ status: nextStatus }).eq('id', id);
  if (error) return { ok: false, formError: error.message };

  revalidatePath('/quotes');
  revalidatePath(`/quotes/${id}`);
  redirect(`/quotes/${id}?saved=quote_updated`);
}

type QuoteForConvert = {
  id: string;
  status: QuoteStatus;
  org_id: string;
  customer_id: string;
  issue_date: string;
  install_address_line1: string | null;
  install_address_line2: string | null;
  install_city: string | null;
  install_state: string | null;
  install_pincode: string | null;
  project_label: string | null;
  subtotal: number | string;
  tax_total: number | string;
  round_off: number | string;
  total: number | string;
  place_of_supply_state: string | null;
  notes: string | null;
};

type LineForConvert = {
  template_id: string | null;
  description: string;
  hsn_sac_code: string | null;
  unit: string;
  quantity: number | string;
  rate: number | string;
  tax_rate_percent: number | string;
  amount: number | string;
  tax_amount: number | string;
  sort_order: number;
};

export type ConvertQuoteState = { ok: boolean; formError?: string };

export async function convertQuoteToInvoice(
  quoteId: string,
): Promise<ConvertQuoteState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, formError: 'Sign in expired.' };

  const { data: quote } = await supabase
    .from('quotes')
    .select(
      `id, status, org_id, customer_id, issue_date,
       install_address_line1, install_address_line2, install_city, install_state, install_pincode,
       project_label, subtotal, tax_total, round_off, total, place_of_supply_state, notes`,
    )
    .eq('id', quoteId)
    .maybeSingle<QuoteForConvert>();
  if (!quote) return { ok: false, formError: 'Quote not found.' };
  if (quote.status === 'converted_to_invoice') {
    return { ok: false, formError: 'Already converted.' };
  }

  const { data: org } = await supabase
    .from('orgs')
    .select('state, terms_text')
    .eq('id', quote.org_id)
    .maybeSingle<{ state: string | null; terms_text: string | null }>();

  const placeOfSupply = quote.place_of_supply_state ?? org?.state ?? null;
  const isIntraState = !!org?.state && !!placeOfSupply && org.state === placeOfSupply;
  const gstType = isIntraState ? 'intra_state' : 'inter_state';

  const taxTotal = Number(quote.tax_total);
  const cgstTotal = isIntraState ? Math.round((taxTotal / 2) * 100) / 100 : 0;
  const sgstTotal = cgstTotal;
  const igstTotal = isIntraState ? 0 : taxTotal;

  // Atomic invoice number
  const { data: invNumber, error: rpcErr } = await supabase.rpc('next_invoice_number', {
    p_org_id: quote.org_id,
  });
  if (rpcErr || !invNumber) {
    return { ok: false, formError: rpcErr?.message ?? 'Could not generate invoice number' };
  }

  const { data: invoice, error: insertErr } = await supabase
    .from('invoices')
    .insert({
      org_id: quote.org_id,
      invoice_number: invNumber as string,
      quote_id: quote.id,
      customer_id: quote.customer_id,
      issue_date: new Date().toISOString().slice(0, 10),
      status: 'issued',
      payment_status: 'unpaid',
      install_address_line1: quote.install_address_line1,
      install_address_line2: quote.install_address_line2,
      install_city: quote.install_city,
      install_state: quote.install_state,
      install_pincode: quote.install_pincode,
      project_label: quote.project_label,
      subtotal: quote.subtotal,
      tax_total: quote.tax_total,
      round_off: quote.round_off,
      total: quote.total,
      amount_paid: 0,
      amount_due: quote.total,
      place_of_supply_state: placeOfSupply,
      gst_type: gstType,
      cgst_total: cgstTotal,
      sgst_total: sgstTotal,
      igst_total: igstTotal,
      notes: quote.notes,
      terms_text: org?.terms_text ?? null,
      created_by: user.id,
    })
    .select('id')
    .single<{ id: string }>();
  if (insertErr || !invoice) {
    return { ok: false, formError: insertErr?.message ?? 'Could not create invoice' };
  }

  // Copy quote_lines → invoice_lines with CGST/SGST/IGST split per line
  const { data: lines } = await supabase
    .from('quote_lines')
    .select(
      'template_id, description, hsn_sac_code, unit, quantity, rate, tax_rate_percent, amount, tax_amount, sort_order',
    )
    .eq('quote_id', quote.id)
    .order('sort_order')
    .returns<LineForConvert[]>();

  if (!lines || lines.length === 0) {
    // Roll back the invoice
    await supabase.from('invoices').delete().eq('id', invoice.id);
    return { ok: false, formError: 'Quote has no line items to convert.' };
  }

  const invLines = lines.map((l) => {
    const taxAmt = Number(l.tax_amount);
    return {
      invoice_id: invoice.id,
      template_id: l.template_id,
      description: l.description,
      hsn_sac_code: l.hsn_sac_code,
      unit: l.unit,
      quantity: l.quantity,
      rate: l.rate,
      tax_rate_percent: l.tax_rate_percent,
      cgst_amount: isIntraState ? Math.round((taxAmt / 2) * 100) / 100 : 0,
      sgst_amount: isIntraState ? Math.round((taxAmt / 2) * 100) / 100 : 0,
      igst_amount: isIntraState ? 0 : taxAmt,
      sort_order: l.sort_order,
    };
  });

  const { error: invLinesErr } = await supabase.from('invoice_lines').insert(invLines);
  if (invLinesErr) {
    await supabase.from('invoices').delete().eq('id', invoice.id);
    return { ok: false, formError: `Couldn't copy line items: ${invLinesErr.message}` };
  }

  // Mark the quote converted + link to the invoice
  await supabase
    .from('quotes')
    .update({ status: 'converted_to_invoice', invoice_id: invoice.id })
    .eq('id', quote.id);

  revalidatePath('/quotes');
  revalidatePath(`/quotes/${quote.id}`);
  revalidatePath('/invoices');
  redirect(`/invoices/${invoice.id}?saved=invoice_created`);
}
