-- =====================================================================
-- SmallBiz Ops - 0014 membership-safe delete_org
-- 2026-05-31
--
-- The 0010 delete_org() hard-deleted EVERY member's auth.users row. Under the
-- 0013 multi-business model that would destroy a co-member who also belongs to
-- another business. This rewrite:
--   * owner-gates via role_in_org(current_org_id());
--   * deletes the org's data + its memberships + invites;
--   * hard-deletes ONLY members with no remaining memberships (orphans) -
--     cascading to their profiles;
--   * repoints surviving members (kept in other orgs) whose home/active org was
--     this one, so their session lands in another business;
--   * uses the app.org_teardown GUC (honored by the 0013 triggers) to bypass
--     the self-org-change guard and the last-owner guard during teardown.
-- Signature unchanged: delete_org() with no args (the client calls rpc('delete_org')).
-- =====================================================================

create or replace function public.delete_org()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_org uuid;
  v_user_ids uuid[];
begin
  v_org := public.current_org_id();
  if v_org is null then
    raise exception 'No active business to delete.';
  end if;
  if public.role_in_org(v_org) <> 'owner' then
    raise exception 'Only the owner can delete the business.';
  end if;

  -- Permit the teardown writes the 0013 guards would otherwise block
  -- (deleting the last owner's membership; repointing the owner's own org_id).
  perform set_config('app.org_teardown', 'on', true);

  -- Snapshot members BEFORE we delete memberships.
  v_user_ids := array(select user_id from public.memberships where org_id = v_org);

  -- Domain data, children first (customer FKs are ON DELETE RESTRICT).
  -- invoice_milestones / quote_milestones cascade from their parent rows.
  delete from public.payments
        where invoice_id in (select id from public.invoices where org_id = v_org);
  delete from public.invoice_lines
        where invoice_id in (select id from public.invoices where org_id = v_org);
  delete from public.invoices          where org_id = v_org;
  delete from public.quote_lines
        where quote_id in (select id from public.quotes where org_id = v_org);
  delete from public.quotes            where org_id = v_org;
  delete from public.product_templates where org_id = v_org;
  delete from public.customers         where org_id = v_org;
  delete from public.leads             where org_id = v_org;
  delete from public.org_invites       where org_id = v_org;

  -- This org's memberships (last-owner guard bypassed via the GUC).
  delete from public.memberships       where org_id = v_org;

  -- Orphans (no membership left anywhere) -> delete the auth user, which
  -- cascades to their profile and clears its org_id RESTRICT reference.
  delete from auth.users u
   where u.id = any(v_user_ids)
     and not exists (select 1 from public.memberships m where m.user_id = u.id);

  -- Survivors (still in another org) whose home/active org was this one -> repoint.
  update public.profiles p
     set org_id = (select m.org_id from public.memberships m
                   where m.user_id = p.id order by m.created_at limit 1)
   where p.id = any(v_user_ids) and p.org_id = v_org;
  update public.profiles p
     set active_org_id = (select m.org_id from public.memberships m
                          where m.user_id = p.id order by m.created_at limit 1)
   where p.id = any(v_user_ids) and p.active_org_id = v_org;

  -- No profile references the org now -> safe to delete.
  delete from public.orgs where id = v_org;
end;
$$;

grant execute on function public.delete_org() to authenticated;

-- =====================================================================
-- end of migration 0014_delete_org_multi
-- =====================================================================
