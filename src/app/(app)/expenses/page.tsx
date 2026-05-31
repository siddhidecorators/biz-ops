import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchExpenses } from '@/lib/queries/expenses';
import { ExpensesList } from './_components/expenses-list';

export const metadata = { title: 'Expenses' };

export default async function ExpensesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const initialData = await fetchExpenses(supabase).catch(() => undefined);

  return <ExpensesList initialData={initialData} />;
}
