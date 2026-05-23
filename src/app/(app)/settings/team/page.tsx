import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppBar } from '../../_components/app-bar';
import { TeamClient } from './_components/team-client';
import type {
  InviteRow,
  MemberRow,
} from '@/lib/queries/team';

export const metadata = { title: 'Team' };

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role, orgs(name)')
    .eq('id', user.id)
    .maybeSingle<{ org_id: string; role: 'owner' | 'admin' | 'staff'; orgs: { name: string } | null }>();

  // Owner-only page. Non-owners get bounced to /settings so they don't see
  // the button if they somehow guess the URL.
  if (!profile || profile.role !== 'owner') redirect('/settings');

  const [membersRes, invitesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .order('created_at', { ascending: true })
      .returns<MemberRow[]>(),
    supabase
      .from('org_invites')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false })
      .returns<InviteRow[]>(),
  ]);

  const initialMembers = membersRes.data ?? [];
  const initialInvites = invitesRes.data ?? [];

  return (
    <>
      <AppBar
        title="Team"
        subtitle={profile.orgs?.name}
        back={{ href: '/settings' }}
      />
      <main className="mx-auto max-w-md px-6 py-5">
        <TeamClient
          selfUserId={user.id}
          initialMembers={initialMembers}
          initialInvites={initialInvites}
        />
      </main>
    </>
  );
}
