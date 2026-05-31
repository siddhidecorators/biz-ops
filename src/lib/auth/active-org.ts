import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrgRole } from '@/lib/enums';

// Server-side helper: resolves the caller's ACTIVE business + their role in it.
// Single source of truth now that a user can belong to several orgs.
//
// `current_org_id()` (migration 0013) already returns the active org and is
// membership-hardened, so org RLS scopes to it automatically. We read the role
// from `memberships` (NOT profiles.role, which is no longer the gating source).
export type ActiveOrgContext = {
  userId: string;
  orgId: string | null; // active org (null if the user has no membership)
  role: OrgRole | null; // role in the active org
  orgName: string | null;
  settingsComplete: boolean;
  fullName: string | null;
  email: string | null;
  membershipCount: number; // how many businesses the user belongs to
};

export async function getActiveOrgContext(
  supabase: SupabaseClient,
): Promise<ActiveOrgContext | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, org_id, active_org_id')
    .eq('id', user.id)
    .maybeSingle<{ full_name: string | null; org_id: string | null; active_org_id: string | null }>();

  const activeOrgId = profile?.active_org_id ?? profile?.org_id ?? null;

  const { count: membershipCount } = await supabase
    .from('memberships')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  let orgName: string | null = null;
  let settingsComplete = false;
  let role: OrgRole | null = null;

  if (activeOrgId) {
    const [orgRes, memRes] = await Promise.all([
      supabase
        .from('orgs')
        .select('name, settings_complete')
        .eq('id', activeOrgId)
        .maybeSingle<{ name: string; settings_complete: boolean }>(),
      supabase
        .from('memberships')
        .select('role')
        .eq('user_id', user.id)
        .eq('org_id', activeOrgId)
        .maybeSingle<{ role: OrgRole }>(),
    ]);
    orgName = orgRes.data?.name ?? null;
    settingsComplete = orgRes.data?.settings_complete ?? false;
    role = memRes.data?.role ?? null;
  }

  return {
    userId: user.id,
    orgId: activeOrgId,
    role,
    orgName,
    settingsComplete,
    fullName: profile?.full_name ?? null,
    email: user.email ?? null,
    membershipCount: membershipCount ?? 0,
  };
}
