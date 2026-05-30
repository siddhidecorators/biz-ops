import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/browser';
import type { QuoteStatus } from '@/lib/enums';

export type QuoteListRow = {
  id: string;
  quote_number: string;
  status: QuoteStatus;
  issue_date: string;
  valid_until: string;
  total: number | string;
  project_label: string | null;
  customers: { name: string } | null;
};

export const quoteKeys = {
  all: ['quotes'] as const,
  lists: () => [...quoteKeys.all, 'list'] as const,
  list: () => [...quoteKeys.lists()] as const,
  details: () => [...quoteKeys.all, 'detail'] as const,
  detail: (id: string) => [...quoteKeys.details(), id] as const,
};

export async function fetchQuotesList(
  client?: SupabaseClient,
): Promise<QuoteListRow[]> {
  const supabase = client ?? createClient();
  const { data, error } = await supabase
    .from('quotes')
    .select(
      'id, quote_number, status, issue_date, valid_until, total, project_label, customers(name)',
    )
    .order('issue_date', { ascending: false })
    .order('quote_number', { ascending: false })
    .returns<QuoteListRow[]>();

  if (error) throw error;
  return data ?? [];
}
