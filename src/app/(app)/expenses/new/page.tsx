import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isoDate, formatINR } from '@/lib/format';
import { AppBar } from '../../_components/app-bar';
import { ExpenseForm, type InvoiceOption } from '../_components/expense-form';

export const metadata = { title: 'New expense' };

type InvRow = {
  id: string;
  invoice_number: string;
  total: number | string;
  customers: { name: string } | null;
};

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string }>;
}) {
  const { invoice } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: rows } = await supabase
    .from('invoices')
    .select('id, invoice_number, total, customers(name)')
    .order('issue_date', { ascending: false })
    .limit(50)
    .returns<InvRow[]>();

  const invoices: InvoiceOption[] = (rows ?? []).map((r) => ({
    id: r.id,
    label: `${r.invoice_number}${r.customers?.name ? ` · ${r.customers.name}` : ''}`,
    hint: formatINR(r.total),
  }));

  return (
    <>
      <AppBar title="New expense" back={{ href: '/expenses' }} />
      <main className="mx-auto max-w-2xl px-6 py-5">
        <ExpenseForm invoices={invoices} defaultInvoiceId={invoice ?? null} today={isoDate()} />
      </main>
    </>
  );
}
