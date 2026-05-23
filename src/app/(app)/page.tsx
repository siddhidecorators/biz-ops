import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { HomeDashboard } from './_components/home-dashboard';

type ProfileRow = {
  full_name: string | null;
  org_id: string;
  role: string;
  orgs: { name: string; settings_complete: boolean } | null;
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, org_id, role, orgs(name, settings_complete)')
    .eq('id', user.id)
    .maybeSingle<ProfileRow>();

  if (!profile?.orgs?.settings_complete) redirect('/onboarding');

  const firstName = profile.full_name?.split(' ')[0] ?? 'there';

  return <HomeDashboard orgName={profile.orgs.name} firstName={firstName} />;
}
