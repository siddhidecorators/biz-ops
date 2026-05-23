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

export async function fetchMembers(): Promise<MemberRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, created_at')
    .order('created_at', { ascending: true })
    .returns<MemberRow[]>();
  if (error) throw error;
  return data ?? [];
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
