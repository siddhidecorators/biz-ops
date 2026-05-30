'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { LEAD_STATUSES, type LeadStatus } from '@/lib/enums';
import { DEFAULT_CUSTOMER_STATE } from '@/lib/india';

const trimmed = z.string().optional().transform((v) => v?.trim() ?? '');

const schema = z.object({
  name: z.string().transform((v) => v.trim()).pipe(z.string().min(1, 'Name is required')),
  phone: trimmed,
  email: z
    .string()
    .optional()
    .transform((v) => v?.trim() ?? '')
    .refine((v) => v === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Enter a valid email'),
  source: trimmed,
  note: trimmed,
  status: z.enum(LEAD_STATUSES),
});

export type LeadFormState = {
  ok: boolean;
  fieldErrors?: Partial<Record<keyof z.input<typeof schema>, string>>;
  formError?: string;
};

function parse(formData: FormData):
  | { ok: true; data: z.output<typeof schema> }
  | { ok: false; state: LeadFormState } {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: LeadFormState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof z.input<typeof schema>;
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, state: { ok: false, fieldErrors } };
  }
  return { ok: true, data: parsed.data };
}

function toRow(v: z.output<typeof schema>) {
  return {
    name: v.name,
    phone: v.phone || null,
    email: v.email || null,
    source: v.source || null,
    note: v.note || null,
    status: v.status,
  };
}

export async function createLead(
  _prev: LeadFormState | null,
  formData: FormData,
): Promise<LeadFormState> {
  const result = parse(formData);
  if (!result.ok) return result.state;

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
  if (!profile) return { ok: false, formError: 'Profile missing — sign out and back in.' };

  const { error } = await supabase.from('leads').insert({
    org_id: profile.org_id,
    created_by: user.id,
    ...toRow(result.data),
  });
  if (error) return { ok: false, formError: error.message };

  revalidatePath('/leads');
  redirect('/leads?saved=lead_created');
}

export async function updateLead(
  id: string,
  _prev: LeadFormState | null,
  formData: FormData,
): Promise<LeadFormState> {
  const result = parse(formData);
  if (!result.ok) return result.state;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, formError: 'Sign in expired. Reload and try again.' };

  const { error } = await supabase.from('leads').update(toRow(result.data)).eq('id', id);
  if (error) return { ok: false, formError: error.message };

  revalidatePath('/leads');
  revalidatePath(`/leads/${id}`);
  redirect('/leads?saved=lead_updated');
}

export type LeadStatusState = { ok: boolean; formError?: string };

export async function setLeadStatus(
  id: string,
  status: LeadStatus,
): Promise<LeadStatusState> {
  if (!LEAD_STATUSES.includes(status)) return { ok: false, formError: 'Invalid status' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, formError: 'Sign in expired.' };

  const { error } = await supabase.from('leads').update({ status }).eq('id', id);
  if (error) return { ok: false, formError: error.message };

  revalidatePath('/leads');
  revalidatePath(`/leads/${id}`);
  redirect(`/leads/${id}?saved=lead_updated`);
}

export type DeleteLeadState = { ok: boolean; formError?: string };

export async function deleteLead(
  id: string,
  _prev: DeleteLeadState | null,
): Promise<DeleteLeadState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, formError: 'Sign in expired.' };

  const { error } = await supabase.from('leads').delete().eq('id', id);
  if (error) return { ok: false, formError: error.message };

  revalidatePath('/leads');
  redirect('/leads?saved=lead_deleted');
}

// Turn a lead into a quote: ensure a customer exists for it, mark the lead
// quoted, then jump to the new-quote form with that customer preselected.
export async function convertLeadToQuote(id: string): Promise<{ ok: boolean; formError?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, formError: 'Sign in expired.' };

  const { data: lead } = await supabase
    .from('leads')
    .select('id, name, phone, email, customer_id, org_id')
    .eq('id', id)
    .maybeSingle<{
      id: string;
      name: string;
      phone: string | null;
      email: string | null;
      customer_id: string | null;
      org_id: string;
    }>();
  if (!lead) return { ok: false, formError: 'Lead not found.' };

  let customerId = lead.customer_id;

  if (!customerId) {
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .insert({
        org_id: lead.org_id,
        created_by: user.id,
        name: lead.name,
        customer_type: 'homeowner',
        phone: lead.phone ?? '',
        email: lead.email,
        billing_state: DEFAULT_CUSTOMER_STATE,
      })
      .select('id')
      .single<{ id: string }>();
    if (custErr || !customer) {
      return { ok: false, formError: custErr?.message ?? 'Could not create the customer.' };
    }
    customerId = customer.id;
    await supabase
      .from('leads')
      .update({ customer_id: customerId, status: 'quoted' })
      .eq('id', lead.id);
  }

  revalidatePath('/leads');
  redirect(`/quotes/new?customer=${customerId}`);
}
