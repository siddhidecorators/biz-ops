import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingForm, type OrgRow } from './onboarding-form';

export const metadata = { title: 'Setup · SmallBiz Ops' };

export default async function OnboardingPage() {
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
      <main className="mx-auto max-w-md px-6 py-12">
        <h1 className="text-xl font-semibold">Profile not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong setting up your account. Try signing out and back in.
        </p>
      </main>
    );
  }

  const { data: org } = await supabase
    .from('orgs')
    .select('*')
    .eq('id', profile.org_id)
    .maybeSingle<OrgRow>();

  if (!org) {
    return (
      <main className="mx-auto max-w-md px-6 py-12">
        <h1 className="text-xl font-semibold">Org not found</h1>
      </main>
    );
  }

  if (org.settings_complete) redirect('/');

  return (
    <main className="mx-auto max-w-2xl px-6 py-8 pb-16">
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Set up your business</h1>
        <p className="text-sm text-muted-foreground">
          Just the essentials — you can edit anything later from Settings.
        </p>
      </header>
      <OnboardingForm
        org={org}
        defaultSignatory={profile.full_name ?? user.user_metadata?.full_name ?? ''}
        defaultEmail={user.email ?? ''}
      />
    </main>
  );
}
