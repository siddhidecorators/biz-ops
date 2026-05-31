-- =====================================================================
-- SmallBiz Ops - 0017 credit notes + cancellation
-- 2026-05-31
--
-- A GST credit note reverses an invoice (full cancellation or a partial
-- return/correction). It's a document linked to the original invoice, with its
-- own number + taxable value + GST split + reason. A "full" credit note also
-- marks the invoice status='cancelled' (handled in the server action).
--
-- Also patches get_dashboard_counts so cancelled invoices drop out of the
-- "outstanding" / unpaid figures.
-- Org-scoped RLS keys off current_org_id() (the ACTIVE org).
-- =====================================================================

create table public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete restrict,
  credit_note_number text not null,
  issue_date date not null default current_date,
  reason text,
  subtotal numeric(14, 2) not null default 0,
  tax_total numeric(14, 2) not null default 0,
  round_off numeric(8, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  place_of_supply_state text,
  gst_type public.gst_type not null default 'intra_state',
  cgst_total numeric(14, 2) not null default 0,
  sgst_total numeric(14, 2) not null default 0,
  igst_total numeric(14, 2) not null default 0,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, credit_note_number)
);

create index credit_notes_org_id_idx on public.credit_notes (org_id);
create index credit_notes_invoice_id_idx on public.credit_notes (invoice_id);

create trigger credit_notes_set_updated_at
  before update on public.credit_notes
  for each row execute function public.set_updated_at();

alter table public.credit_notes enable row level security;

create policy credit_notes_all on public.credit_notes
  for all
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- Per-org, FY-resetting credit-note number (count-based, like next_quote_number).
create or replace function public.next_credit_note_number(p_org_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fy text;
  v_next int;
begin
  v_fy := public.current_fy();
  select coalesce(max(split_part(credit_note_number, '/', 3)::int), 0) + 1
  into v_next
  from public.credit_notes
  where org_id = p_org_id and credit_note_number like 'CN/' || v_fy || '/%';
  return 'CN/' || v_fy || '/' || lpad(v_next::text, 3, '0');
end;
$$;

grant execute on function public.next_credit_note_number(uuid) to authenticated;

-- Cancelled invoices should not count as receivables.
create or replace function public.get_dashboard_counts()
returns table (
  customers         bigint,
  products          bigint,
  unverified        bigint,
  open_quotes       bigint,
  unpaid_invoices   bigint,
  outstanding       numeric
)
language sql
stable
as $$
  select
    (select count(*)::bigint from public.customers),
    (select count(*)::bigint from public.product_templates where is_active),
    (select count(*)::bigint from public.product_templates where is_active and not verified),
    (select count(*)::bigint from public.quotes where status in ('draft','sent','accepted')),
    (select count(*)::bigint from public.invoices where payment_status in ('unpaid','partial') and status <> 'cancelled'),
    (select coalesce(sum(amount_due), 0)::numeric from public.invoices where payment_status in ('unpaid','partial') and status <> 'cancelled');
$$;

grant execute on function public.get_dashboard_counts() to authenticated;

-- =====================================================================
-- end of migration 0017_credit_notes
-- =====================================================================
