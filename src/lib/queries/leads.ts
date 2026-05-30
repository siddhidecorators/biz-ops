import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/browser';
import type { LeadStatus } from '@/lib/enums';

export type LeadListRow = {
  id: string;
  name: string;
  phone: string | null;
  source: string | null;
  status: LeadStatus;
  created_at: string;
};

export const leadKeys = {
  all: ['leads'] as const,
  lists: () => [...leadKeys.all, 'list'] as const,
  list: () => [...leadKeys.lists()] as const,
  details: () => [...leadKeys.all, 'detail'] as const,
  detail: (id: string) => [...leadKeys.details(), id] as const,
};

export async function fetchLeads(
  client?: SupabaseClient,
): Promise<LeadListRow[]> {
  const supabase = client ?? createClient();
  const { data, error } = await supabase
    .from('leads')
    .select('id, name, phone, source, status, created_at')
    .order('created_at', { ascending: false })
    .returns<LeadListRow[]>();
  if (error) throw error;
  return data ?? [];
}
