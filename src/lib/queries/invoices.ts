import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/browser';
import type { InvoiceStatus, PaymentStatus } from '@/lib/enums';

export type InvoiceListRow = {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  payment_status: PaymentStatus;
  issue_date: string;
  total: number | string;
  amount_due: number | string;
  project_label: string | null;
  customers: { name: string } | null;
};

export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: () => [...invoiceKeys.lists()] as const,
  details: () => [...invoiceKeys.all, 'detail'] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
};

export async function fetchInvoicesList(
  client?: SupabaseClient,
): Promise<InvoiceListRow[]> {
  const supabase = client ?? createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select(
      'id, invoice_number, status, payment_status, issue_date, total, amount_due, project_label, customers(name)',
    )
    .order('issue_date', { ascending: false })
    .order('invoice_number', { ascending: false })
    .returns<InvoiceListRow[]>();

  if (error) throw error;
  return data ?? [];
}
