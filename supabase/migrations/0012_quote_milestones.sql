-- =====================================================================
-- SmallBiz Ops - 0012 quote payment schedule (proposed milestones)
-- 2026-05-31
--
-- Mirror of 0011_invoice_milestones, on the quote side. Lets a business
-- PROPOSE payment terms on a quote ("50% advance, balance on completion"),
-- show them on the quote + its PDF, and carry them into the invoice's
-- schedule when the quote is converted (see convertQuoteToInvoice).
--
-- Quotes have no payments, so these are purely proposed terms - no settlement.
-- RLS scoped through the parent quote, like quote_lines.
-- =====================================================================

create table public.quote_milestones (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  label text not null,
  percent numeric(5, 2),
  amount numeric(14, 2) not null check (amount >= 0),
  due_date date,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index quote_milestones_quote_id_idx
  on public.quote_milestones (quote_id);

alter table public.quote_milestones enable row level security;

create policy quote_milestones_all on public.quote_milestones
  for all
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id and q.org_id = public.current_org_id()
    )
  )
  with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id and q.org_id = public.current_org_id()
    )
  );

-- =====================================================================
-- end of migration 0012_quote_milestones
-- =====================================================================
