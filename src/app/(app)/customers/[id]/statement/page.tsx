import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppBar } from '../../../_components/app-bar';
import { StatementView } from './_components/statement-view';

export const metadata = { title: 'Statement' };

type Row = { id: string; name: string; phone: string; share_token: string };

export default async function CustomerStatementPage({
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

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, phone, share_token')
    .eq('id', id)
    .maybeSingle<Row>();
  if (!customer) notFound();

  const { data: profile } = await supabase
    .from('profiles')
    .select('orgs(name)')
    .eq('id', user.id)
    .maybeSingle<{ orgs: { name: string } | null }>();

  return (
    <>
      <AppBar
        title="Statement"
        subtitle={customer.name}
        back={{ href: `/customers/${customer.id}` }}
      />
      <StatementView
        customerId={customer.id}
        customerName={customer.name}
        customerPhone={customer.phone}
        shareToken={customer.share_token}
        orgName={profile?.orgs?.name ?? 'Your business'}
      />
    </>
  );
}
