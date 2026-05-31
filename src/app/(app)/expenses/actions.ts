'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { EXPENSE_CATEGORIES } from '@/lib/enums';

const trimmed = z.string().optional().transform((v) => v?.trim() ?? '');

const schema = z.object({
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .pipe(z.number().positive('Amount must be more than zero')),
  category: z.enum(EXPENSE_CATEGORIES),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date'),
  vendor: trimmed,
  bill_number: trimmed,
  description: trimmed,
  notes: trimmed,
  invoice_id: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
});

export type ExpenseFormState = {
  ok: boolean;
  fieldErrors?: Partial<Record<keyof z.input<typeof schema>, string>>;
  formError?: string;
};

export async function createExpense(
  _prev: ExpenseFormState | null,
  formData: FormData,
): Promise<ExpenseFormState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: ExpenseFormState['fieldErrors'] = {};
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

  // Use the ACTIVE business (multi-business) — must match RLS current_org_id().
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, active_org_id')
    .eq('id', user.id)
    .maybeSingle<{ org_id: string | null; active_org_id: string | null }>();
  const orgId = profile?.active_org_id ?? profile?.org_id;
  if (!orgId) return { ok: false, formError: 'No active business — try signing back in.' };

  const v = parsed.data;
  const { error } = await supabase.from('expenses').insert({
    org_id: orgId,
    created_by: user.id,
    invoice_id: v.invoice_id,
    category: v.category,
    amount: v.amount,
    expense_date: v.expense_date,
    vendor: v.vendor || null,
    bill_number: v.bill_number || null,
    description: v.description || null,
    notes: v.notes || null,
  });
  if (error) return { ok: false, formError: error.message };

  revalidatePath('/expenses');
  if (v.invoice_id) revalidatePath(`/invoices/${v.invoice_id}`);
  redirect('/expenses?saved=expense_created');
}
