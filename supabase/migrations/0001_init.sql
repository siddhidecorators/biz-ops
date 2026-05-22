-- =====================================================================
-- SmallBiz Ops — Phase 1 initial schema
-- 2026-05-21
--
-- Multi-tenant from day one: every domain table carries org_id and RLS
-- restricts access to rows where org_id = current_user's org_id.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ENUMs
-- ---------------------------------------------------------------------
create type customer_type as enum ('homeowner', 'designer', 'builder', 'other');

create type craft as enum (
  'wallpaper', 'wooden_flooring', 'pvc_flooring', 'pvc_panel',
  'wpc_louver', 'fluted_panel', 'carpet', 'stretch_ceiling',
  'blinds', 'curtains', 'glass_film', 'mosquito_mesh',
  'artificial_grass', 'vertical_garden'
);

create type unit_of_measure as enum (
  'sq_ft', 'sq_meter', 'running_ft', 'running_meter',
  'piece', 'set', 'roll', 'meter'
);

create type org_role as enum ('owner', 'admin', 'staff');

create type quote_status as enum (
  'draft', 'sent', 'accepted', 'declined', 'converted_to_invoice', 'expired'
);

create type invoice_status as enum ('draft', 'issued', 'cancelled');

create type payment_status as enum ('unpaid', 'partial', 'paid');

create type payment_mode as enum (
  'cash', 'upi', 'bank_transfer', 'cheque', 'card', 'other'
);

create type gst_type as enum ('intra_state', 'inter_state');

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Indian financial year — 'YYYY-YY' for April → March, e.g. '2025-26'
create or replace function public.current_fy()
returns text
language plpgsql
immutable
as $$
declare
  d date := current_date;
  y int;
begin
  if extract(month from d) >= 4 then
    y := extract(year from d);
  else
    y := extract(year from d) - 1;
  end if;
  return y::text || '-' || lpad(((y + 1) % 100)::text, 2, '0');
end;
$$;

-- Current user's org_id (read once via profiles), used inside RLS.
-- Uses plpgsql so the body is parsed lazily — the profiles table doesn't
-- need to exist at function creation time.
create or replace function public.current_org_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from public.profiles where id = auth.uid();
  return v_org_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. orgs
-- ---------------------------------------------------------------------
create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gstin text,
  pan text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  pincode text,
  country text not null default 'IN',
  phone text,
  email text,
  logo_url text,
  signatory_name text,
  bank_account_name text,
  bank_account_number text,
  bank_ifsc text,
  bank_name text,
  upi_id text,
  invoice_prefix text not null default 'INV',
  invoice_series_year text not null default public.current_fy(),
  invoice_next_number int not null default 1,
  quote_validity_days int not null default 30,
  terms_text text,
  brand_color text not null default '#B8552A',
  settings_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger orgs_set_updated_at
  before update on public.orgs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 2. profiles
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references public.orgs(id) on delete restrict,
  full_name text,
  role org_role not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_org_id_idx on public.profiles (org_id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. customers
-- ---------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  customer_type customer_type not null default 'homeowner',
  phone text not null,
  alt_phone text,
  email text,
  gstin text,
  billing_address_line1 text,
  billing_address_line2 text,
  billing_city text,
  billing_state text,
  billing_pincode text,
  billing_country text not null default 'IN',
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_org_id_idx on public.customers (org_id);
create index customers_phone_idx on public.customers (phone);
create index customers_name_idx on public.customers (lower(name));

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. product_templates
-- ---------------------------------------------------------------------
create table public.product_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  brand text,
  craft craft not null,
  hsn_sac_code text,
  unit unit_of_measure not null,
  default_rate numeric(12, 2),
  tax_rate_percent numeric(5, 2),
  verified boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_templates_org_id_idx on public.product_templates (org_id);
create index product_templates_craft_idx on public.product_templates (craft);

create trigger product_templates_set_updated_at
  before update on public.product_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5. quotes
-- ---------------------------------------------------------------------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  quote_number text not null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  issue_date date not null default current_date,
  valid_until date not null,
  status quote_status not null default 'draft',
  install_address_line1 text,
  install_address_line2 text,
  install_city text,
  install_state text,
  install_pincode text,
  project_label text,
  subtotal numeric(14, 2) not null default 0,
  tax_total numeric(14, 2) not null default 0,
  round_off numeric(8, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  place_of_supply_state text,
  notes text,
  -- invoice_id FK added after invoices table is created
  invoice_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, quote_number)
);

create index quotes_org_id_idx on public.quotes (org_id);
create index quotes_customer_id_idx on public.quotes (customer_id);
create index quotes_status_idx on public.quotes (status);

create trigger quotes_set_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 6. quote_lines
-- ---------------------------------------------------------------------
create table public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  template_id uuid references public.product_templates(id) on delete set null,
  description text not null,
  hsn_sac_code text,
  unit unit_of_measure not null,
  quantity numeric(12, 3) not null,
  rate numeric(12, 2) not null,
  tax_rate_percent numeric(5, 2) not null default 0,
  amount numeric(14, 2) generated always as (round(quantity * rate, 2)) stored,
  tax_amount numeric(14, 2) generated always as (round(quantity * rate * tax_rate_percent / 100, 2)) stored,
  line_total numeric(14, 2) generated always as (round(quantity * rate, 2) + round(quantity * rate * tax_rate_percent / 100, 2)) stored,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index quote_lines_quote_id_idx on public.quote_lines (quote_id);

-- ---------------------------------------------------------------------
-- 7. invoices
-- ---------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  invoice_number text not null,
  quote_id uuid references public.quotes(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  issue_date date not null default current_date,
  status invoice_status not null default 'issued',
  payment_status payment_status not null default 'unpaid',
  install_address_line1 text,
  install_address_line2 text,
  install_city text,
  install_state text,
  install_pincode text,
  project_label text,
  subtotal numeric(14, 2) not null default 0,
  tax_total numeric(14, 2) not null default 0,
  round_off numeric(8, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  amount_paid numeric(14, 2) not null default 0,
  amount_due numeric(14, 2) not null default 0,
  place_of_supply_state text,
  gst_type gst_type not null default 'intra_state',
  cgst_total numeric(14, 2) not null default 0,
  sgst_total numeric(14, 2) not null default 0,
  igst_total numeric(14, 2) not null default 0,
  notes text,
  terms_text text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, invoice_number)
);

create index invoices_org_id_idx on public.invoices (org_id);
create index invoices_customer_id_idx on public.invoices (customer_id);
create index invoices_payment_status_idx on public.invoices (payment_status);

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- Now wire quotes.invoice_id -> invoices.id
alter table public.quotes
  add constraint quotes_invoice_id_fkey
  foreign key (invoice_id) references public.invoices(id) on delete set null;

-- ---------------------------------------------------------------------
-- 8. invoice_lines
-- ---------------------------------------------------------------------
create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  template_id uuid references public.product_templates(id) on delete set null,
  description text not null,
  hsn_sac_code text,
  unit unit_of_measure not null,
  quantity numeric(12, 3) not null,
  rate numeric(12, 2) not null,
  tax_rate_percent numeric(5, 2) not null default 0,
  amount numeric(14, 2) generated always as (round(quantity * rate, 2)) stored,
  tax_amount numeric(14, 2) generated always as (round(quantity * rate * tax_rate_percent / 100, 2)) stored,
  line_total numeric(14, 2) generated always as (round(quantity * rate, 2) + round(quantity * rate * tax_rate_percent / 100, 2)) stored,
  cgst_amount numeric(14, 2) not null default 0,
  sgst_amount numeric(14, 2) not null default 0,
  igst_amount numeric(14, 2) not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index invoice_lines_invoice_id_idx on public.invoice_lines (invoice_id);

-- ---------------------------------------------------------------------
-- 9. payments
-- ---------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  payment_date date not null default current_date,
  mode payment_mode not null,
  reference text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index payments_invoice_id_idx on public.payments (invoice_id);

-- ---------------------------------------------------------------------
-- Auto-create org + profile on auth.users insert (new signup)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_org_id uuid;
  display_name text;
begin
  display_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  insert into public.orgs (name)
  values (display_name || '''s business')
  returning id into new_org_id;

  insert into public.profiles (id, org_id, full_name, role)
  values (new.id, new_org_id, display_name, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Atomic invoice number generator (per org, FY-resetting)
-- ---------------------------------------------------------------------
create or replace function public.next_invoice_number(p_org_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.orgs%rowtype;
  v_fy text;
  v_number int;
begin
  v_fy := public.current_fy();

  select * into v_org
  from public.orgs
  where id = p_org_id
  for update;

  if not found then
    raise exception 'Org % not found', p_org_id;
  end if;

  if v_org.invoice_series_year is distinct from v_fy then
    update public.orgs
    set invoice_series_year = v_fy,
        invoice_next_number = 2
    where id = p_org_id;
    v_number := 1;
  else
    update public.orgs
    set invoice_next_number = invoice_next_number + 1
    where id = p_org_id;
    v_number := v_org.invoice_next_number;
  end if;

  return v_org.invoice_prefix || '/' || v_fy || '/' || lpad(v_number::text, 3, '0');
end;
$$;

-- Quote number generator (simpler — counts existing quotes in current FY)
create or replace function public.next_quote_number(p_org_id uuid)
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
  select coalesce(max(split_part(quote_number, '/', 3)::int), 0) + 1
  into v_next
  from public.quotes
  where org_id = p_org_id
    and quote_number like 'Q/' || v_fy || '/%';
  return 'Q/' || v_fy || '/' || lpad(v_next::text, 3, '0');
end;
$$;

-- ---------------------------------------------------------------------
-- Payment status auto-update on payments insert/update/delete
-- ---------------------------------------------------------------------
create or replace function public.recalc_invoice_payment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_total numeric(14, 2);
  v_paid numeric(14, 2);
  v_status payment_status;
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);

  select total into v_total from public.invoices where id = v_invoice_id;

  select coalesce(sum(amount), 0) into v_paid
  from public.payments
  where invoice_id = v_invoice_id;

  if v_paid <= 0 then
    v_status := 'unpaid';
  elsif v_paid >= v_total then
    v_status := 'paid';
  else
    v_status := 'partial';
  end if;

  update public.invoices
  set amount_paid = v_paid,
      amount_due = greatest(v_total - v_paid, 0),
      payment_status = v_status
  where id = v_invoice_id;

  return null;
end;
$$;

create trigger payments_recalc_invoice
  after insert or update or delete on public.payments
  for each row execute function public.recalc_invoice_payment_status();

-- ---------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------
alter table public.orgs              enable row level security;
alter table public.profiles          enable row level security;
alter table public.customers         enable row level security;
alter table public.product_templates enable row level security;
alter table public.quotes            enable row level security;
alter table public.quote_lines       enable row level security;
alter table public.invoices          enable row level security;
alter table public.invoice_lines     enable row level security;
alter table public.payments          enable row level security;

-- orgs: a user can see and update only their own org
create policy orgs_select on public.orgs
  for select using (id = public.current_org_id());
create policy orgs_update on public.orgs
  for update using (id = public.current_org_id())
  with check (id = public.current_org_id());

-- profiles: see anyone in the same org; update only your own row
create policy profiles_select on public.profiles
  for select using (org_id = public.current_org_id());
create policy profiles_update on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- customers
create policy customers_all on public.customers
  for all
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- product_templates
create policy product_templates_all on public.product_templates
  for all
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- quotes
create policy quotes_all on public.quotes
  for all
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- quote_lines (scoped via parent quote)
create policy quote_lines_all on public.quote_lines
  for all
  using (
    exists (select 1 from public.quotes q where q.id = quote_id and q.org_id = public.current_org_id())
  )
  with check (
    exists (select 1 from public.quotes q where q.id = quote_id and q.org_id = public.current_org_id())
  );

-- invoices
create policy invoices_all on public.invoices
  for all
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- invoice_lines
create policy invoice_lines_all on public.invoice_lines
  for all
  using (
    exists (select 1 from public.invoices i where i.id = invoice_id and i.org_id = public.current_org_id())
  )
  with check (
    exists (select 1 from public.invoices i where i.id = invoice_id and i.org_id = public.current_org_id())
  );

-- payments
create policy payments_all on public.payments
  for all
  using (
    exists (select 1 from public.invoices i where i.id = invoice_id and i.org_id = public.current_org_id())
  )
  with check (
    exists (select 1 from public.invoices i where i.id = invoice_id and i.org_id = public.current_org_id())
  );

-- ---------------------------------------------------------------------
-- Storage: org-assets bucket (logos, signatures)
-- Convention: <bucket>/<org_id>/<filename>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('org-assets', 'org-assets', false)
on conflict (id) do nothing;

create policy "org-assets read own org"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'org-assets'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "org-assets insert own org"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'org-assets'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "org-assets update own org"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'org-assets'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  )
  with check (
    bucket_id = 'org-assets'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "org-assets delete own org"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'org-assets'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

-- =====================================================================
-- end of migration 0001_init
-- =====================================================================
