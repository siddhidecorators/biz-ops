-- 0010_delete_org — owner-only "delete this business" support.
--
-- A plain `delete from orgs` is blocked by the schema (profiles.org_id and the
-- customer FKs are ON DELETE RESTRICT). This SECURITY DEFINER function removes
-- the caller's whole org in FK-safe order, in a single transaction, so it's
-- all-or-nothing. It is owner-gated inside the function (not just by RLS).
--
-- It also removes the member auth accounts so re-signing-up starts a fresh
-- business (avoids leaving a logged-in user pointing at a deleted org).

create or replace function public.delete_org()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id  uuid;
  v_role    public.org_role;
  v_user_ids uuid[];
begin
  select org_id, role into v_org_id, v_role
    from public.profiles
   where id = auth.uid();

  if v_org_id is null then
    raise exception 'No business found for the current user';
  end if;
  if v_role <> 'owner' then
    raise exception 'Only the owner can delete the business';
  end if;

  -- Remember the member accounts before their profiles are deleted.
  v_user_ids := array(select id from public.profiles where org_id = v_org_id);

  -- Children first, then parents (FKs to customers/profiles are RESTRICT).
  delete from public.payments
        where invoice_id in (select id from public.invoices where org_id = v_org_id);
  delete from public.invoice_lines
        where invoice_id in (select id from public.invoices where org_id = v_org_id);
  delete from public.invoices        where org_id = v_org_id;
  delete from public.quote_lines
        where quote_id in (select id from public.quotes where org_id = v_org_id);
  delete from public.quotes          where org_id = v_org_id;
  delete from public.product_templates where org_id = v_org_id;
  delete from public.customers       where org_id = v_org_id;
  delete from public.leads           where org_id = v_org_id;
  delete from public.org_invites     where org_id = v_org_id;
  delete from public.profiles        where org_id = v_org_id;
  delete from public.orgs            where id = v_org_id;

  -- Finally the auth accounts (org/profiles/data already gone, so no RESTRICT).
  delete from auth.users where id = any(v_user_ids);
end;
$$;

grant execute on function public.delete_org() to authenticated;
