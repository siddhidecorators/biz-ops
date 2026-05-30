import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchLeads } from '@/lib/queries/leads';
import { LeadsList } from './_components/leads-list';

export const metadata = { title: 'Leads' };

export default async function LeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const initialData = await fetchLeads(supabase).catch(() => undefined);

  return <LeadsList initialData={initialData} />;
}
