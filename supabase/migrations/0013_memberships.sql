-- =====================================================================
-- SmallBiz Ops - 0013 multi-business memberships
-- 2026-05-31
--
-- Turns the 1:1 user->org model into many-to-many: a user can belong to
-- several orgs (each with a role) and switch the "active" one. Strategy:
--   * memberships(user_id, org_id, role) = source of truth for access.
--   * profiles.active_org_id = currently selected org (profiles.org_id kept
--     as the immutable "home" org + fallback).
--   * current_org_id() resolves the active org BUT returns NULL unless a
--     membership backs it -> a stale/foreign pointer grants zero access
--     (domain RLS only checks org_id = current_org_id()).
--   * All sensitive writes go through SECURITY DEFINER RPCs; memberships RLS
--     predicates call definer helpers to avoid policy recursion.
-- Existing domain RLS is UNCHANGED (still keys off current_org_id()).
--
-- Backward compatible: after backfill, single-org users have active_org_id =
-- org_id and one membership, so current_org_id()/role behave exactly as before.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. memberships
-- ---------------------------------------------------------------------
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  role public.org_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, org_id)
);
create index if not exists memberships_user_id_idx on public.memberships (user_id);
create index if not exists memberships_org_id_idx on public.memberships (org_id);
alter table public.memberships enable row level security;

-- ---------------------------------------------------------------------
-- 2. profiles.active_org_id (ON DELETE SET NULL so deleting an org doesn't
--    block on a survivor's pointer; current_org_id() falls back to org_id)
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists active_org_id uuid references public.orgs(id) on delete set null;

-- ---------------------------------------------------------------------
-- 3. Definer helpers (bypass RLS -> used by triggers + memberships policies
--    to avoid infinite policy recursion)
-- ---------------------------------------------------------------------
create or replace function public.is_member_of(p_org_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.memberships where user_id = auth.uid() and org_id = p_org_id
  );
$$;

create or replace function public.role_in_org(p_org_id uuid)
returns public.org_role language sql stable security definer set search_path = public, auth as $$
  select role from public.memberships where user_id = auth.uid() and org_id = p_org_id;
$$;

create or replace function public.owner_count(p_org_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.memberships where org_id = p_org_id and role = 'owner';
$$;

grant execute on function public.is_member_of(uuid) to authenticated;
grant execute on function public.role_in_org(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Backfill (idempotent): one membership per existing profile; active = home
-- ---------------------------------------------------------------------
insert into public.memberships (user_id, org_id, role, created_at)
select id, org_id, role, created_at from public.profiles where org_id is not null
on conflict (user_id, org_id) do nothing;

update public.profiles set active_org_id = org_id
where org_id is not null and active_org_id is null;

-- ---------------------------------------------------------------------
-- 5. Redefine current_org_id() - HARDENED: NULL unless a membership backs the
--    resolved org. This is the core tenant-isolation guard.
-- ---------------------------------------------------------------------
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public, auth as $$
  select s.o from (
    select coalesce(active_org_id, org_id) as o from public.profiles where id = auth.uid()
  ) s
  where exists (
    select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id = s.o
  );
$$;

-- ---------------------------------------------------------------------
-- 6. Redefine current_org_role() - role for the active org (from memberships)
-- ---------------------------------------------------------------------
create or replace function public.current_org_role()
returns public.org_role language sql stable security definer set search_path = public, auth as $$
  select role from public.memberships
  where user_id = auth.uid() and org_id = public.current_org_id();
$$;

-- ---------------------------------------------------------------------
-- 7. memberships RLS (recursion-free: predicates use definer helpers)
-- ---------------------------------------------------------------------
drop policy if exists memberships_select on public.memberships;
drop policy if exists memberships_update_owner on public.memberships;
drop policy if exists memberships_delete_owner on public.memberships;

create policy memberships_select on public.memberships for select
  using (user_id = auth.uid() or public.is_member_of(org_id));

-- No INSERT policy: rows are created only by SECURITY DEFINER RPCs / the
-- signup trigger (which bypass RLS). This removes "mint myself into an org".

create policy memberships_update_owner on public.memberships for update
  using (public.role_in_org(org_id) = 'owner' and user_id <> auth.uid())
  with check (public.role_in_org(org_id) = 'owner' and user_id <> auth.uid());

create policy memberships_delete_owner on public.memberships for delete
  using (public.role_in_org(org_id) = 'owner' and user_id <> auth.uid());

-- ---------------------------------------------------------------------
-- 8. Extend the 0005 self-guard: also validate active_org_id switches.
--    An org-teardown GUC (set by delete_org) lets the owner repoint their own
--    org_id while deleting a business.
-- ---------------------------------------------------------------------
create or replace function public.prevent_self_role_or_org_change()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then return new; end if;
  if new.id = auth.uid() then
    if new.role is distinct from old.role then
      raise exception 'You cannot change your own role.';
    end if;
    if new.org_id is distinct from old.org_id
       and coalesce(current_setting('app.org_teardown', true), 'off') <> 'on' then
      raise exception 'You cannot change your own organization.';
    end if;
    if new.active_org_id is distinct from old.active_org_id
       and new.active_org_id is not null
       and not public.is_member_of(new.active_org_id) then
      raise exception 'You are not a member of that business.';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Last-owner protection on memberships (skipped during org teardown)
-- ---------------------------------------------------------------------
create or replace function public.protect_last_owner()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if coalesce(current_setting('app.org_teardown', true), 'off') = 'on' then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    if old.role = 'owner' and public.owner_count(old.org_id) <= 1 then
      raise exception 'Cannot remove the last owner of a business.';
    end if;
    return old;
  elsif tg_op = 'UPDATE' then
    if old.role = 'owner' and new.role <> 'owner' and public.owner_count(old.org_id) <= 1 then
      raise exception 'Cannot demote the last owner of a business.';
    end if;
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists memberships_protect_last_owner on public.memberships;
create trigger memberships_protect_last_owner
  before update or delete on public.memberships
  for each row execute function public.protect_last_owner();

-- ---------------------------------------------------------------------
-- 10. handle_new_user: also create a membership; consume only the joined invite
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
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

  select * into invite_row
  from public.org_invites
  where email = lower(new.email)
  order by created_at desc
  limit 1;

  if found then
    insert into public.profiles (id, org_id, active_org_id, full_name, role)
    values (new.id, invite_row.org_id, invite_row.org_id, display_name, invite_row.role);
    insert into public.memberships (user_id, org_id, role)
    values (new.id, invite_row.org_id, invite_row.role)
    on conflict (user_id, org_id) do nothing;
    -- Consume only the joined org's invite; others surface via list_my_invites().
    delete from public.org_invites where email = lower(new.email) and org_id = invite_row.org_id;
  else
    insert into public.orgs (name)
    values (display_name || '''s business')
    returning id into new_org_id;
    insert into public.profiles (id, org_id, active_org_id, full_name, role)
    values (new.id, new_org_id, new_org_id, display_name, 'owner');
    insert into public.memberships (user_id, org_id, role)
    values (new.id, new_org_id, 'owner');
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 11. RPCs (SECURITY DEFINER) for switching / creating / invites / team
-- ---------------------------------------------------------------------
create or replace function public.switch_active_org(p_org_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not exists (select 1 from public.memberships where user_id = auth.uid() and org_id = p_org_id) then
    raise exception 'Not a member of that business.';
  end if;
  update public.profiles set active_org_id = p_org_id where id = auth.uid();
end;
$$;

create or replace function public.create_additional_org(p_name text)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare v_org uuid; v_name text;
begin
  v_name := nullif(btrim(p_name), '');
  if v_name is null then raise exception 'Business name is required.'; end if;
  insert into public.orgs (name) values (v_name) returning id into v_org;
  insert into public.memberships (user_id, org_id, role) values (auth.uid(), v_org, 'owner');
  update public.profiles set active_org_id = v_org where id = auth.uid();
  return v_org;
end;
$$;

create or replace function public.list_my_orgs()
returns table (org_id uuid, name text, logo_url text, role public.org_role, settings_complete boolean, is_active boolean)
language sql stable security definer set search_path = public, auth as $$
  select o.id, o.name, o.logo_url, m.role, o.settings_complete,
         (o.id = public.current_org_id()) as is_active
  from public.memberships m
  join public.orgs o on o.id = m.org_id
  where m.user_id = auth.uid()
  order by o.name;
$$;

create or replace function public.list_my_invites()
returns table (org_id uuid, org_name text, role public.org_role, created_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select i.org_id, o.name, i.role, i.created_at
  from public.org_invites i
  join public.orgs o on o.id = i.org_id
  where i.email = lower((select email from auth.users where id = auth.uid()))
    and not exists (
      select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id = i.org_id
    );
$$;

create or replace function public.accept_invite(p_org_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_email text; v_role public.org_role;
begin
  select lower(email) into v_email from auth.users where id = auth.uid();
  select role into v_role from public.org_invites where org_id = p_org_id and email = v_email;
  if v_role is null then raise exception 'No invitation for you in that business.'; end if;
  insert into public.memberships (user_id, org_id, role)
  values (auth.uid(), p_org_id, v_role)
  on conflict (user_id, org_id) do nothing;
  delete from public.org_invites where org_id = p_org_id and email = v_email;
end;
$$;

-- Owner-only, ORG-SCOPED role change (never touches your own row).
create or replace function public.set_member_role(p_org_id uuid, p_user_id uuid, p_role public.org_role)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if public.role_in_org(p_org_id) <> 'owner' then raise exception 'Only an owner can change roles.'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot change your own role.'; end if;
  update public.memberships set role = p_role where org_id = p_org_id and user_id = p_user_id;
  -- last-owner demotion blocked by the protect_last_owner trigger
end;
$$;

-- Owner-only, ORG-SCOPED removal; repoints the removed user's pointers.
create or replace function public.remove_member(p_org_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if public.role_in_org(p_org_id) <> 'owner' then raise exception 'Only an owner can remove members.'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot remove yourself here.'; end if;
  delete from public.memberships where org_id = p_org_id and user_id = p_user_id;
  -- Repoint the removed user away from this org (avoids a stale active pointer).
  update public.profiles p
  set active_org_id = (select m.org_id from public.memberships m where m.user_id = p_user_id order by m.created_at limit 1)
  where p.id = p_user_id and p.active_org_id = p_org_id;
  update public.profiles p
  set org_id = (select m.org_id from public.memberships m where m.user_id = p_user_id order by m.created_at limit 1)
  where p.id = p_user_id and p.org_id = p_org_id;
end;
$$;

grant execute on function public.switch_active_org(uuid) to authenticated;
grant execute on function public.create_additional_org(text) to authenticated;
grant execute on function public.list_my_orgs() to authenticated;
grant execute on function public.list_my_invites() to authenticated;
grant execute on function public.accept_invite(uuid) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, public.org_role) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;

-- =====================================================================
-- end of migration 0013_memberships
-- =====================================================================
