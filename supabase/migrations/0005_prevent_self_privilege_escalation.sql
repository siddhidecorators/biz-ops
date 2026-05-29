-- =====================================================================
-- Phase 2B hardening — block self privilege-escalation / tenant-hop
-- =====================================================================
-- The profiles_update_self RLS policy (0004) lets a user update their own
-- profile row, but RLS can't restrict WHICH columns change. That means a
-- non-owner could, via a crafted API call, set their own role = 'owner'
-- (privilege escalation) or change their own org_id (hop into another
-- tenant's data). The UI never exposes this, but the API allows it.
--
-- Fix: a BEFORE UPDATE trigger that forbids a user from changing their OWN
-- role or org_id. Owners changing OTHER members' rows (id <> auth.uid()) are
-- unaffected, so changeRole / removeMember keep working. Inserts (handle_new_user,
-- which runs with no auth.uid()) are unaffected since this is UPDATE-only.

create or replace function public.prevent_self_role_or_org_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- System/definer contexts (e.g. the signup trigger) have no auth user — allow.
  if auth.uid() is null then
    return new;
  end if;

  -- A user may not escalate their own role or move their own account between orgs.
  if new.id = auth.uid() then
    if new.role is distinct from old.role then
      raise exception 'You cannot change your own role.';
    end if;
    if new.org_id is distinct from old.org_id then
      raise exception 'You cannot change your own organization.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_self_escalation on public.profiles;
create trigger profiles_prevent_self_escalation
  before update on public.profiles
  for each row execute function public.prevent_self_role_or_org_change();
