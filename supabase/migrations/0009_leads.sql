-- =====================================================================
-- Feature — leads / inquiry tracking
-- =====================================================================
-- Captures walk-ins, calls and referrals before they become quotes. A simple
-- pipeline: new → contacted → quoted → won / lost. Org-scoped like every
-- other domain table.

create type lead_status as enum ('new', 'contacted', 'quoted', 'won', 'lost');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  source text,
  note text,
  status lead_status not null default 'new',
  customer_id uuid references public.customers(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_org_id_idx on public.leads (org_id);
create index leads_status_idx on public.leads (org_id, status);

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

alter table public.leads enable row level security;

create policy "leads_select_own_org"
  on public.leads for select using (org_id = public.current_org_id());
create policy "leads_insert_own_org"
  on public.leads for insert with check (org_id = public.current_org_id());
create policy "leads_update_own_org"
  on public.leads for update
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
create policy "leads_delete_own_org"
  on public.leads for delete using (org_id = public.current_org_id());
