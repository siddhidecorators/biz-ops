-- =====================================================================
-- Phase 2A — single RPC for the home dashboard
-- =====================================================================
-- The home page previously fanned out into 5 head COUNT(*) queries.
-- This function returns the same five counts in one round trip.
--
-- Runs as the caller (default INVOKER), so the RLS policies on each
-- table do the org_id scoping for us — no need to plumb org_id through
-- the function signature.

create or replace function public.get_dashboard_counts()
returns table (
  customers         bigint,
  products          bigint,
  unverified        bigint,
  open_quotes       bigint,
  unpaid_invoices   bigint
)
language sql
stable
as $$
  select
    (select count(*)::bigint from public.customers)                                       as customers,
    (select count(*)::bigint from public.product_templates where is_active)               as products,
    (select count(*)::bigint from public.product_templates where is_active and not verified) as unverified,
    (select count(*)::bigint from public.quotes where status in ('draft','sent','accepted')) as open_quotes,
    (select count(*)::bigint from public.invoices where payment_status in ('unpaid','partial')) as unpaid_invoices;
$$;

grant execute on function public.get_dashboard_counts() to authenticated;
