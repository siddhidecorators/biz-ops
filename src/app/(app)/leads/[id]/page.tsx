import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LeadForm, type LeadDefaults } from '../_components/lead-form';
import { LeadActions } from '../_components/lead-actions';
import { DeleteLeadButton } from '../_components/delete-button';
import { updateLead } from '../actions';
import type { LeadStatus } from '@/lib/enums';
import { AppBar } from '../../_components/app-bar';

export const metadata = { title: 'Lead' };

type Row = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  note: string | null;
  status: LeadStatus;
  customer_id: string | null;
};

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: lead } = await supabase
    .from('leads')
    .select('id, name, phone, email, source, note, status, customer_id')
    .eq('id', id)
    .maybeSingle<Row>();
  if (!lead) notFound();

  const defaults: LeadDefaults = {
    name: lead.name,
    phone: lead.phone ?? '',
    email: lead.email ?? '',
    source: lead.source ?? '',
    note: lead.note ?? '',
    status: lead.status,
  };
  const action = updateLead.bind(null, lead.id);

  return (
    <>
      <AppBar title={lead.name} subtitle="Lead" back={{ href: '/leads' }} />
      <main className="mx-auto max-w-2xl space-y-6 px-6 py-5">
        <LeadActions leadId={lead.id} status={lead.status} />
        <LeadForm action={action} defaults={defaults} submitLabel="Save changes" />
        <div className="flex justify-center border-t border-border pt-6">
          <DeleteLeadButton leadId={lead.id} leadName={lead.name} />
        </div>
      </main>
    </>
  );
}
