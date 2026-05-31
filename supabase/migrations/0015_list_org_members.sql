-- =====================================================================
-- SmallBiz Ops - 0015 list_org_members RPC
-- 2026-05-31
--
-- The Team page lists the members of the ACTIVE org. Under the 0013 model a
-- member's profile.org_id (home) may differ from the active org, so the
-- profiles SELECT policy can't surface their name. This SECURITY DEFINER RPC
-- joins memberships -> profiles for the active org, gated to members of it.
-- =====================================================================

create or replace function public.list_org_members()
returns table (user_id uuid, full_name text, role public.org_role, created_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select m.user_id, p.full_name, m.role, m.created_at
  from public.memberships m
  left join public.profiles p on p.id = m.user_id
  where m.org_id = public.current_org_id()
    and public.is_member_of(public.current_org_id())
  order by m.created_at;
$$;

grant execute on function public.list_org_members() to authenticated;

-- =====================================================================
-- end of migration 0015_list_org_members
-- =====================================================================
