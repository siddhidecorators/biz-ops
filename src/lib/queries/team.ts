import { createClient } from '@/lib/supabase/browser';
import type { OrgRole } from '@/lib/enums';

export type MemberRow = {
  id: string;
  full_name: string | null;
  role: OrgRole;
  created_at: string;
};

export type InviteRow = {
  id: string;
  email: string;
  role: OrgRole;
  created_at: string;
};

export const teamKeys = {
  all: ['team'] as const,
  members: () => [...teamKeys.all, 'members'] as const,
  invites: () => [...teamKeys.all, 'invites'] as const,
};

type MemberRpcRow = {
  user_id: string;
  full_name: string | null;
  role: OrgRole;
  created_at: string;
};

// Members of the ACTIVE org, via the SECURITY DEFINER RPC (joins memberships ->
// profiles; a member's home org may differ from the active one, so a plain
// profiles select can't see their name).
export async function fetchMembers(): Promise<MemberRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('list_org_members');
  if (error) throw error;
  return ((data ?? []) as MemberRpcRow[]).map((r) => ({
    id: r.user_id,
    full_name: r.full_name,
    role: r.role,
    created_at: r.created_at,
  }));
}

export async function fetchInvites(): Promise<InviteRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('org_invites')
    .select('id, email, role, created_at')
    .order('created_at', { ascending: false })
    .returns<InviteRow[]>();
  if (error) throw error;
  return data ?? [];
}
