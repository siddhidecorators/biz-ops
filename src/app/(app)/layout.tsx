import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveOrgContext } from '@/lib/auth/active-org';
import { BottomNav } from './_components/bottom-nav';
import { ToastFromQuery } from './_components/toast-from-query';
import { NetworkStatusBadge } from './_components/network-status-badge';

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Centralized gate (a user can now belong to several businesses): bounce to
  // onboarding when there's no business yet, or the ACTIVE one isn't set up.
  // Without this, switching into a brand-new business would render every page
  // against an unconfigured org. (/onboarding lives outside this group — no loop.)
  const supabase = await createClient();
  const ctx = await getActiveOrgContext(supabase);
  if (!ctx) redirect('/sign-in');
  if (!ctx.orgId || !ctx.settingsComplete) redirect('/onboarding');

  return (
    <>
      <div className="pb-24">{children}</div>
      <BottomNav />
      <ToastFromQuery />
      <NetworkStatusBadge />
    </>
  );
}
