'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  isValidGstinFormat,
  isValidIfscFormat,
  isValidPanFormat,
  isValidPincodeFormat,
  INDIAN_STATES,
} from '@/lib/india';

const stateCodes = INDIAN_STATES.map((s) => s.code) as [string, ...string[]];

const optional = (predicate: (s: string) => boolean, message: string) =>
  z
    .string()
    .optional()
    .transform((v) => v?.trim() ?? '')
    .refine((v) => v === '' || predicate(v), message);

const schema = z.object({
  name: z.string().min(1, 'Business name is required'),
  phone: z.string().optional().transform((v) => v?.trim() ?? ''),
  email: z
    .string()
    .optional()
    .transform((v) => v?.trim() ?? '')
    .refine((v) => v === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Enter a valid email'),
  gstin: optional((s) => isValidGstinFormat(s.toUpperCase()), 'GSTIN format is invalid'),
  pan: optional((s) => isValidPanFormat(s.toUpperCase()), 'PAN format is invalid'),
  address_line1: z.string().optional().transform((v) => v?.trim() ?? ''),
  address_line2: z.string().optional().transform((v) => v?.trim() ?? ''),
  city: z.string().optional().transform((v) => v?.trim() ?? ''),
  state: z
    .string()
    .optional()
    .transform((v) => v?.trim() ?? '')
    .refine((v) => v === '' || stateCodes.includes(v), 'Pick a valid Indian state/UT'),
  pincode: optional(isValidPincodeFormat, 'Pincode must be 6 digits'),
  signatory_name: z.string().optional().transform((v) => v?.trim() ?? ''),
  bank_account_name: z.string().optional().transform((v) => v?.trim() ?? ''),
  bank_account_number: z.string().optional().transform((v) => v?.trim() ?? ''),
  bank_ifsc: optional((s) => isValidIfscFormat(s.toUpperCase()), 'IFSC format is invalid'),
  bank_name: z.string().optional().transform((v) => v?.trim() ?? ''),
  upi_id: z.string().optional().transform((v) => v?.trim() ?? ''),
});

export type OnboardingFormState = {
  ok: boolean;
  fieldErrors?: Partial<Record<keyof z.input<typeof schema>, string>>;
  formError?: string;
};

export async function saveOnboarding(
  _prev: OnboardingFormState | null,
  formData: FormData,
): Promise<OnboardingFormState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: OnboardingFormState['fieldErrors'] = {};
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, active_org_id')
    .eq('id', user.id)
    .maybeSingle<{ org_id: string | null; active_org_id: string | null }>();
  if (!profile) return { ok: false, formError: 'Profile missing — try signing out and back in.' };

  const v = parsed.data;

  // Target the ACTIVE business (a user can own several now). If the user somehow
  // has no business yet, bootstrap one via the definer RPC.
  let orgId = profile.active_org_id ?? profile.org_id;
  if (!orgId) {
    const { data: newOrg, error: createErr } = await supabase.rpc('create_additional_org', {
      p_name: v.name,
    });
    if (createErr || !newOrg) {
      return { ok: false, formError: createErr?.message ?? 'Could not create the business.' };
    }
    orgId = newOrg as string;
  }

  const update = {
    name: v.name,
    phone: v.phone || null,
    email: v.email || null,
    gstin: v.gstin ? v.gstin.toUpperCase() : null,
    pan: v.pan ? v.pan.toUpperCase() : null,
    address_line1: v.address_line1 || null,
    address_line2: v.address_line2 || null,
    city: v.city || null,
    state: v.state || null,
    pincode: v.pincode || null,
    signatory_name: v.signatory_name || null,
    bank_account_name: v.bank_account_name || null,
    bank_account_number: v.bank_account_number || null,
    bank_ifsc: v.bank_ifsc ? v.bank_ifsc.toUpperCase() : null,
    bank_name: v.bank_name || null,
    upi_id: v.upi_id || null,
    settings_complete: true,
  };

  const { error } = await supabase.from('orgs').update(update).eq('id', orgId);
  if (error) return { ok: false, formError: error.message };

  redirect('/?saved=settings_saved');
}
