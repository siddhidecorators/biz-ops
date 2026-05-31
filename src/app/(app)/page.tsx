import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveOrgContext } from '@/lib/auth/active-org';
import { HomeDashboard } from './_components/home-dashboard';

export default async function Home() {
  const supabase = await createClient();
  const ctx = await getActiveOrgContext(supabase);
  if (!ctx) redirect('/sign-in');
  // The layout already gates this, but keep the guard for direct hits.
  if (!ctx.orgId || !ctx.settingsComplete) redirect('/onboarding');

  const firstName = ctx.fullName?.split(' ')[0] ?? 'there';

  return <HomeDashboard orgName={ctx.orgName ?? 'Your business'} firstName={firstName} />;
}
