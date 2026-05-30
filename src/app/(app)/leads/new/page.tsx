import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LeadForm } from '../_components/lead-form';
import { createLead } from '../actions';
import { AppBar } from '../../_components/app-bar';

export const metadata = { title: 'Add lead' };

export default async function NewLeadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  return (
    <>
      <AppBar title="Add lead" back={{ href: '/leads' }} />
      <main className="mx-auto max-w-2xl px-6 py-5">
        <LeadForm action={createLead} defaults={{ status: 'new' }} submitLabel="Save lead" />
      </main>
    </>
  );
}
