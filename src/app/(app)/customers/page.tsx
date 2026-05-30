import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchCustomersList } from '@/lib/queries/customers';
import { CustomersList } from './_components/customers-list';

export const metadata = { title: 'Customers' };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { q = '' } = await searchParams;
  const initialData = await fetchCustomersList(q, supabase).catch(() => undefined);
  return <CustomersList initialQuery={q} initialData={initialData} />;
}
