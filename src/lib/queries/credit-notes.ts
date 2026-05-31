import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/browser';

export type CreditNoteForInvoice = {
  id: string;
  credit_note_number: string;
  issue_date: string;
  total: number | string;
  reason: string | null;
};

export async function fetchCreditNotesForInvoice(
  invoiceId: string,
  client?: SupabaseClient,
): Promise<CreditNoteForInvoice[]> {
  const supabase = client ?? createClient();
  const { data, error } = await supabase
    .from('credit_notes')
    .select('id, credit_note_number, issue_date, total, reason')
    .eq('invoice_id', invoiceId)
    .order('issue_date', { ascending: false })
    .returns<CreditNoteForInvoice[]>();
  if (error) throw error;
  return data ?? [];
}
