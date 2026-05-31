'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  isValidGstinFormat,
  isValidPincodeFormat,
  INDIAN_STATES,
} from '@/lib/india';
import { CUSTOMER_TYPES } from '@/lib/enums';

const stateCodes = INDIAN_STATES.map((s) => s.code) as [string, ...string[]];

const optionalWith = (predicate: (s: string) => boolean, message: string) =>
  z
    .string()
    .optional()
    .transform((v) => v?.trim() ?? '')
    .refine((v) => v === '' || predicate(v), message);

const trimmed = z.string().optional().transform((v) => v?.trim() ?? '');

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  customer_type: z.enum(CUSTOMER_TYPES),
  phone: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1, 'Phone is required')),
  alt_phone: trimmed,
  email: z
    .string()
    .optional()
    .transform((v) => v?.trim() ?? '')
    .refine((v) => v === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Enter a valid email'),
  gstin: optionalWith((s) => isValidGstinFormat(s.toUpperCase()), 'GSTIN format is invalid'),
  billing_address_line1: trimmed,
  billing_address_line2: trimmed,
  billing_city: trimmed,
  billing_state: z
    .string()
    .optional()
    .transform((v) => v?.trim() ?? '')
    .refine((v) => v === '' || stateCodes.includes(v), 'Pick a valid Indian state/UT'),
  billing_pincode: optionalWith(isValidPincodeFormat, 'Pincode must be 6 digits'),
  notes: trimmed,
});

export type CustomerFormState = {
  ok: boolean;
  fieldErrors?: Partial<Record<keyof z.input<typeof schema>, string>>;
  formError?: string;
};

function parse(formData: FormData): {
  ok: true;
  data: z.output<typeof schema>;
} | {
  ok: false;
  state: CustomerFormState;
} {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: CustomerFormState['fieldErrors'] = {};
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
    name: v.name.trim(),
    customer_type: v.customer_type,
    phone: v.phone,
    alt_phone: v.alt_phone || null,
    email: v.email || null,
    gstin: v.gstin ? v.gstin.toUpperCase() : null,
    billing_address_line1: v.billing_address_line1 || null,
    billing_address_line2: v.billing_address_line2 || null,
    billing_city: v.billing_city || null,
    billing_state: v.billing_state || null,
    billing_pincode: v.billing_pincode || null,
    notes: v.notes || null,
  };
}

export async function createCustomer(
  _prev: CustomerFormState | null,
  formData: FormData,
): Promise<CustomerFormState> {
  const result = parse(formData);
  if (!result.ok) return result.state;

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
  if (!profile) return { ok: false, formError: 'Profile missing — try signing out and back in.' };

  const orgId = profile.active_org_id ?? profile.org_id;
  if (!orgId) return { ok: false, formError: 'No active business.' };

  const { error } = await supabase.from('customers').insert({
    org_id: orgId,
    created_by: user.id,
    ...toRow(result.data),
  });
  if (error) return { ok: false, formError: error.message };

  revalidatePath('/customers');
  redirect('/customers?saved=customer_created');
}

export async function updateCustomer(
  id: string,
  _prev: CustomerFormState | null,
  formData: FormData,
): Promise<CustomerFormState> {
  const result = parse(formData);
  if (!result.ok) return result.state;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, formError: 'Sign in expired. Reload and try again.' };

  const { error } = await supabase.from('customers').update(toRow(result.data)).eq('id', id);
  if (error) return { ok: false, formError: error.message };

  revalidatePath('/customers');
  revalidatePath(`/customers/${id}`);
  redirect('/customers?saved=customer_updated');
}

export type DeleteCustomerState = { ok: boolean; formError?: string };

export async function deleteCustomer(
  id: string,
  _prev: DeleteCustomerState | null,
): Promise<DeleteCustomerState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, formError: 'Sign in expired. Reload and try again.' };

  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      return {
        ok: false,
        formError: "This customer has quotes or invoices and can't be deleted.",
      };
    }
    return { ok: false, formError: error.message };
  }

  revalidatePath('/customers');
  redirect('/customers?saved=customer_deleted');
}
