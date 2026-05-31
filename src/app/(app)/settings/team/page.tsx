import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppBar } from '../../_components/app-bar';
import { TeamClient } from './_components/team-client';
import { getActiveOrgContext } from '@/lib/auth/active-org';
import type { InviteRow, MemberRow } from '@/lib/queries/team';

export const metadata = { title: 'Team' };

type MemberRpcRow = {
  user_id: string;
  full_name: string | null;
  role: MemberRow['role'];
  created_at: string;
};

export default async function TeamPage() {
  const supabase = await createClient();
  const ctx = await getActiveOrgContext(supabase);
  if (!ctx) redirect('/sign-in');
  // Owner-only page (role is for the ACTIVE business).
  if (!ctx.orgId || ctx.role !== 'owner') redirect('/settings');

  const [membersRes, invitesRes] = await Promise.all([
    supabase.rpc('list_org_members'),
    supabase
      .from('org_invites')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false })
      .returns<InviteRow[]>(),
  ]);

  const initialMembers: MemberRow[] = ((membersRes.data ?? []) as MemberRpcRow[]).map((r) => ({
    id: r.user_id,
    full_name: r.full_name,
    role: r.role,
    created_at: r.created_at,
  }));
  const initialInvites = invitesRes.data ?? [];

  return (
    <>
      <AppBar title="Team" subtitle={ctx.orgName ?? undefined} back={{ href: '/settings' }} />
      <main className="mx-auto max-w-md px-6 py-5">
        <TeamClient
          orgId={ctx.orgId}
          selfUserId={ctx.userId}
          initialMembers={initialMembers}
          initialInvites={initialInvites}
        />
      </main>
    </>
  );
}
