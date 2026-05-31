-- =====================================================================
-- SmallBiz Ops - 0016 expenses (cost tracking + profit per project)
-- 2026-05-31
--
-- A simple expense/purchase register. An expense can optionally link to an
-- invoice so profit-per-project = invoice.total - sum(expenses for it).
-- Org-scoped RLS keys off current_org_id() (the ACTIVE org), so it is
-- multi-business-aware automatically.
-- =====================================================================

create type public.expense_category as enum (
  'materials', 'labour', 'transport', 'subcontractor', 'other'
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  category public.expense_category not null default 'materials',
  amount numeric(14, 2) not null check (amount > 0),
  expense_date date not null default current_date,
  vendor text,
  description text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_org_id_idx on public.expenses (org_id);
create index expenses_invoice_id_idx on public.expenses (invoice_id);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

alter table public.expenses enable row level security;

create policy expenses_all on public.expenses
  for all
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- =====================================================================
-- end of migration 0016_expenses
-- =====================================================================
