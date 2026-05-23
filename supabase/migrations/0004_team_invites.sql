-- =====================================================================
-- Phase 2B — team invites + role-based access
-- =====================================================================
-- Adds the org_invites table, a current_org_role() helper for RLS gates,
-- and rewires handle_new_user so a first-time sign-in attaches the user
-- to a matching pending invite instead of always minting a new org.

-- ---------------------------------------------------------------------
-- 1. current_org_role() helper
-- ---------------------------------------------------------------------
-- Mirrors current_org_id() but returns the caller's role so RLS policies
-- can gate writes to owner-only without joining profiles every time.
create or replace function public.current_org_role()
returns org_role
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_role org_role;
begin
  if auth.uid() is null then
    return null;
  end if;
  select role into v_role from public.profiles where id = auth.uid();
  return v_role;
end;
$$;

grant execute on function public.current_org_role() to authenticated;

-- ---------------------------------------------------------------------
-- 2. org_invites table
-- ---------------------------------------------------------------------
create table if not exists public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  -- Stored lowercased so matching at sign-in time is case-insensitive.
  email text not null check (email = lower(email)),
  role org_role not null default 'staff',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Same org can't double-invite the same email. Different orgs can — last
  -- one wins at sign-in time (see handle_new_user below).
  unique (org_id, email)
);

create index if not exists org_invites_email_idx on public.org_invites (email);

create trigger org_invites_set_updated_at
  before update on public.org_invites
  for each row execute function public.set_updated_at();

alter table public.org_invites enable row level security;

-- Members of an org can see their pending invites (so the team page works
-- for non-owners too, though non-owners can't act on them).
create policy "org_invites_select_own_org"
  on public.org_invites for select
  using (org_id = public.current_org_id());

-- Only owners can create/update/delete invites.
create policy "org_invites_insert_owner"
  on public.org_invites for insert
  with check (
    org_id = public.current_org_id()
    and public.current_org_role() = 'owner'
  );

create policy "org_invites_update_owner"
  on public.org_invites for update
  using (org_id = public.current_org_id() and public.current_org_role() = 'owner')
  with check (org_id = public.current_org_id() and public.current_org_role() = 'owner');

create policy "org_invites_delete_owner"
  on public.org_invites for delete
  using (org_id = public.current_org_id() and public.current_org_role() = 'owner');

-- ---------------------------------------------------------------------
-- 3. Profile management RLS — let owners read/update org-mates
-- ---------------------------------------------------------------------
-- Current policies allow only self-read. Replace with org-scoped read so
-- /settings/team can list teammates, and add an owner-only update for role
-- changes / membership revocation.

drop policy if exists "profiles_select_self" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;

create policy "profiles_select_own_org"
  on public.profiles for select
  using (
    id = auth.uid()
    or (org_id is not null and org_id = public.current_org_id())
  );

create policy "profiles_update_self"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_update_owner_in_org"
  on public.profiles for update
  using (
    org_id = public.current_org_id()
    and public.current_org_role() = 'owner'
    and id <> auth.uid()
  )
  with check (
    -- Owner can update any teammate's row but only fields that don't
    -- escalate themselves; column-level grants would be the strict guard,
    -- this RLS just keeps cross-org writes impossible.
    (org_id is null or org_id = public.current_org_id())
  );

-- ---------------------------------------------------------------------
-- 4. Updated handle_new_user trigger
-- ---------------------------------------------------------------------
-- Sign-in flow now does:
--   1. Lower-case the new auth user's email.
--   2. If there's a pending org_invites row matching the email, attach
--      the profile to that org with the invite's role, and delete every
--      pending invite for that email across all orgs (since the user
--      can only be in one org in this Phase 2 model).
--   3. Otherwise, fall back to the original behaviour: mint a new org
--      named "<display>'s business" with the user as owner.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_org_id uuid;
  display_name text;
  invite_row public.org_invites%rowtype;
begin
  display_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  -- Look for the most recent matching pending invite. The unique
  -- (org_id, email) constraint means at most one per org; across orgs we
  -- take the most recent.
  select * into invite_row
  from public.org_invites
  where email = lower(new.email)
  order by created_at desc
  limit 1;

  if found then
    insert into public.profiles (id, org_id, full_name, role)
    values (new.id, invite_row.org_id, display_name, invite_row.role);

    -- Consume the invite (and any others targeting this email).
    delete from public.org_invites where email = lower(new.email);
  else
    insert into public.orgs (name)
    values (display_name || '''s business')
    returning id into new_org_id;

    insert into public.profiles (id, org_id, full_name, role)
    values (new.id, new_org_id, display_name, 'owner');
  end if;

  return new;
end;
$$;
