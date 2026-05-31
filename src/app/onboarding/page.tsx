import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingForm, type OrgRow } from './onboarding-form';

export const metadata = { title: 'Setup · SmallBiz Ops' };

const BLANK_ORG: OrgRow = {
  id: '',
  name: '',
  gstin: null,
  pan: null,
  address_line1: null,
  address_line2: null,
  city: null,
  state: null,
  pincode: null,
  phone: null,
  email: null,
  signatory_name: null,
  bank_account_name: null,
  bank_account_number: null,
  bank_ifsc: null,
  bank_name: null,
  upi_id: null,
  settings_complete: false,
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, active_org_id, full_name')
    .eq('id', user.id)
    .maybeSingle<{ org_id: string | null; active_org_id: string | null; full_name: string | null }>();

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

  // Set up the ACTIVE business (could be a newly-created second business).
  const activeOrgId = profile.active_org_id ?? profile.org_id;
  const { data: org } = activeOrgId
    ? await supabase.from('orgs').select('*').eq('id', activeOrgId).maybeSingle<OrgRow>()
    : { data: null };

  if (org?.settings_complete) redirect('/');

  return (
    <main className="mx-auto max-w-2xl px-6 py-8 pb-16">
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Set up your business</h1>
        <p className="text-sm text-muted-foreground">
          Just the essentials — you can edit anything later from Settings.
        </p>
      </header>
      <OnboardingForm
        org={org ?? BLANK_ORG}
        defaultSignatory={profile.full_name ?? user.user_metadata?.full_name ?? ''}
        defaultEmail={user.email ?? ''}
      />
    </main>
  );
}
