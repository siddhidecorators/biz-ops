import { createClient } from '@/lib/supabase/browser';
import type { PaymentStatus } from '@/lib/enums';

export type StatementInvoice = {
  id: string;
  invoice_number: string;
  issue_date: string;
  total: number | string;
  amount_paid: number | string;
  amount_due: number | string;
  payment_status: PaymentStatus;
};

export const statementKeys = {
  all: ['statement'] as const,
  forCustomer: (customerId: string) => [...statementKeys.all, customerId] as const,
};

export async function fetchCustomerInvoices(
  customerId: string,
): Promise<StatementInvoice[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, issue_date, total, amount_paid, amount_due, payment_status')
    .eq('customer_id', customerId)
    .order('issue_date', { ascending: false })
    .returns<StatementInvoice[]>();
  if (error) throw error;
  return data ?? [];
}

export function totalDue(invoices: StatementInvoice[]): number {
  return invoices.reduce((sum, i) => sum + (Number(i.amount_due) || 0), 0);
}
