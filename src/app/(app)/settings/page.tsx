import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingForm, type OrgRow } from '@/app/onboarding/onboarding-form';
import { AppBar } from '../_components/app-bar';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, full_name')
    .eq('id', user.id)
    .maybeSingle<{ org_id: string; full_name: string | null }>();

  if (!profile) {
    return (
      <>
        <AppBar title="Settings" back={{ href: '/' }} />
        <main className="mx-auto max-w-md px-6 py-12">
          <h1 className="text-xl font-medium">Profile not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Try signing out and back in.
          </p>
        </main>
      </>
    );
  }

  const { data: org } = await supabase
    .from('orgs')
    .select('*')
    .eq('id', profile.org_id)
    .maybeSingle<OrgRow>();

  if (!org) {
    return (
      <>
        <AppBar title="Settings" back={{ href: '/' }} />
        <main className="mx-auto max-w-md px-6 py-12">
          <h1 className="text-xl font-medium">Org not found</h1>
        </main>
      </>
    );
  }

  return (
    <>
      <AppBar
        title="Business settings"
        subtitle={org.name}
        back={{ href: '/' }}
      />
      <main className="mx-auto max-w-2xl px-6 py-5">
        <p className="mb-5 text-sm text-muted-foreground">
          These details show up on invoices and quotes. Update anything and tap Save.
        </p>
        <OnboardingForm
          org={org}
          defaultSignatory={profile.full_name ?? user.user_metadata?.full_name ?? ''}
          defaultEmail={user.email ?? ''}
          submitLabel="Save changes"
        />
      </main>
    </>
  );
}
