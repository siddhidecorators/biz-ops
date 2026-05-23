import { createClient } from '@/lib/supabase/browser';
import type { CustomerType } from '@/lib/enums';

export type CustomerListRow = {
  id: string;
  name: string;
  customer_type: CustomerType;
  phone: string;
  billing_city: string | null;
};

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (q: string) => [...customerKeys.lists(), q] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
};

export async function fetchCustomersList(q: string): Promise<CustomerListRow[]> {
  const supabase = createClient();
  // Keep the filter sanitization identical to the previous server query:
  // restrict to safe PostgREST .or() characters and escape ILIKE wildcards.
  const safeTerm = q.trim().replace(/[^\p{L}\p{N}\s.+\-]/gu, '');
  const escaped = safeTerm.replace(/[%_]/g, (m) => `\\${m}`);

  let query = supabase
    .from('customers')
    .select('id, name, customer_type, phone, billing_city')
    .order('name', { ascending: true })
    .limit(200);

  if (escaped) {
    query = query.or(`name.ilike.%${escaped}%,phone.ilike.%${escaped}%`);
  }

  const { data, error } = await query.returns<CustomerListRow[]>();
  if (error) throw error;
  return data ?? [];
}
