'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { CRAFTS, UNITS } from '@/lib/enums';

const trimmed = z.string().optional().transform((v) => v?.trim() ?? '');

const numericOptional = z
  .string()
  .optional()
  .transform((v) => v?.trim() ?? '')
  .refine((v) => v === '' || /^\d+(\.\d{1,2})?$/.test(v), 'Use a number like 1250 or 1250.50')
  .transform((v) => (v === '' ? null : Number(v)));

const taxRateOptional = z
  .string()
  .optional()
  .transform((v) => v?.trim() ?? '')
  .refine((v) => v === '' || /^\d+(\.\d{1,2})?$/.test(v), 'Use a number like 12 or 18.5')
  .refine((v) => {
    if (v === '') return true;
    const n = Number(v);
    return n >= 0 && n <= 100;
  }, 'Tax rate must be between 0 and 100')
  .transform((v) => (v === '' ? null : Number(v)));

const schema = z.object({
  name: z.string().transform((v) => v.trim()).pipe(z.string().min(1, 'Name is required')),
  brand: trimmed,
  craft: z.enum(CRAFTS),
  unit: z.enum(UNITS),
  hsn_sac_code: trimmed,
  default_rate: numericOptional,
  tax_rate_percent: taxRateOptional,
  verified: z.string().optional().transform((v) => v === 'on' || v === 'true'),
  is_active: z.string().optional().transform((v) => v === 'on' || v === 'true'),
  notes: trimmed,
});

export type ProductFormState = {
  ok: boolean;
  fieldErrors?: Partial<Record<keyof z.input<typeof schema>, string>>;
  formError?: string;
};

function parse(formData: FormData): {
  ok: true;
  data: z.output<typeof schema>;
} | {
  ok: false;
  state: ProductFormState;
} {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: ProductFormState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof z.input<typeof schema>;
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, state: { ok: false, fieldErrors } };
  }
  return { ok: true, data: parsed.data };
}

function toRow(v: z.output<typeof schema>, defaultActive = true) {
  return {
    name: v.name,
    brand: v.brand || null,
    craft: v.craft,
    unit: v.unit,
    hsn_sac_code: v.hsn_sac_code || null,
    default_rate: v.default_rate,
    tax_rate_percent: v.tax_rate_percent,
    verified: v.verified,
    // For create flows the form omits the toggle and we default true.
    is_active: defaultActive ? true : v.is_active,
    notes: v.notes || null,
  };
}

export async function createProduct(
  _prev: ProductFormState | null,
  formData: FormData,
): Promise<ProductFormState> {
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
  if (!profile) return { ok: false, formError: 'Profile missing — try signing out and back in.' };

  const { error } = await supabase.from('product_templates').insert({
    org_id: profile.org_id,
    created_by: user.id,
    ...toRow(result.data, true),
  });
  if (error) return { ok: false, formError: error.message };

  revalidatePath('/products');
  redirect('/products?saved=product_created');
}

export async function updateProduct(
  id: string,
  _prev: ProductFormState | null,
  formData: FormData,
): Promise<ProductFormState> {
  const result = parse(formData);
  if (!result.ok) return result.state;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, formError: 'Sign in expired. Reload and try again.' };

  const { error } = await supabase
    .from('product_templates')
    .update(toRow(result.data, false))
    .eq('id', id);
  if (error) return { ok: false, formError: error.message };

  revalidatePath('/products');
  revalidatePath(`/products/${id}`);
  redirect('/products?saved=product_updated');
}

export type DeleteProductState = { ok: boolean; formError?: string };

export async function deleteProduct(
  id: string,
  _prev: DeleteProductState | null,
): Promise<DeleteProductState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, formError: 'Sign in expired. Reload and try again.' };

  const { error } = await supabase.from('product_templates').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      return {
        ok: false,
        formError:
          'This template is referenced by quote or invoice lines. Mark it inactive instead.',
      };
    }
    return { ok: false, formError: error.message };
  }

  revalidatePath('/products');
  redirect('/products?saved=product_deleted');
}
