import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LeadsList } from './_components/leads-list';

export const metadata = { title: 'Leads' };

export default async function LeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  return <LeadsList />;
}
