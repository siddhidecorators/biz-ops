import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/browser';
import type { ExpenseCategory } from '@/lib/enums';

export type ExpenseListRow = {
  id: string;
  category: ExpenseCategory;
  amount: number | string;
  expense_date: string;
  vendor: string | null;
  description: string | null;
  invoice_id: string | null;
  invoices: { invoice_number: string } | null;
};

export type ExpenseForInvoice = {
  id: string;
  category: ExpenseCategory;
  amount: number | string;
  expense_date: string;
  vendor: string | null;
  description: string | null;
};

export const expenseKeys = {
  all: ['expenses'] as const,
  lists: () => [...expenseKeys.all, 'list'] as const,
  list: () => [...expenseKeys.lists()] as const,
  forInvoice: (invoiceId: string) => [...expenseKeys.all, 'invoice', invoiceId] as const,
};

export async function fetchExpenses(client?: SupabaseClient): Promise<ExpenseListRow[]> {
  const supabase = client ?? createClient();
  const { data, error } = await supabase
    .from('expenses')
    .select(
      'id, category, amount, expense_date, vendor, description, invoice_id, invoices(invoice_number)',
    )
    .order('expense_date', { ascending: false })
    .returns<ExpenseListRow[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchExpensesForInvoice(
  invoiceId: string,
  client?: SupabaseClient,
): Promise<ExpenseForInvoice[]> {
  const supabase = client ?? createClient();
  const { data, error } = await supabase
    .from('expenses')
    .select('id, category, amount, expense_date, vendor, description')
    .eq('invoice_id', invoiceId)
    .order('expense_date', { ascending: false })
    .returns<ExpenseForInvoice[]>();
  if (error) throw error;
  return data ?? [];
}
