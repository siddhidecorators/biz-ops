import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { InvoicesList } from './_components/invoices-list';

export const metadata = { title: 'Invoices' };

export default async function InvoicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  return <InvoicesList />;
}
