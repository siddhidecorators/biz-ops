import { createClient } from '@/lib/supabase/browser';
import type { Craft, Unit } from '@/lib/enums';

export type ProductListRow = {
  id: string;
  name: string;
  brand: string | null;
  craft: Craft;
  unit: Unit;
  hsn_sac_code: string | null;
  default_rate: number | string | null;
  tax_rate_percent: number | string | null;
  verified: boolean;
  is_active: boolean;
};

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filter: { showAll: boolean }) =>
    [...productKeys.lists(), filter.showAll ? 'all' : 'active'] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
};

export async function fetchProductsList({
  showAll,
}: {
  showAll: boolean;
}): Promise<ProductListRow[]> {
  const supabase = createClient();
  let query = supabase
    .from('product_templates')
    .select(
      'id, name, brand, craft, unit, hsn_sac_code, default_rate, tax_rate_percent, verified, is_active',
    )
    .order('name', { ascending: true });

  if (!showAll) query = query.eq('is_active', true);

  const { data, error } = await query.returns<ProductListRow[]>();
  if (error) throw error;
  return data ?? [];
}
