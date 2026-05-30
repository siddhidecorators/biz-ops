import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchInvoicesList } from '@/lib/queries/invoices';
import { InvoicesList } from './_components/invoices-list';

export const metadata = { title: 'Invoices' };

export default async function InvoicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  // Server-fetch the first paint so the list shows real rows immediately
  // (no skeleton); the client revalidates in the background.
  const initialData = await fetchInvoicesList(supabase).catch(() => undefined);

  return <InvoicesList initialData={initialData} />;
}
