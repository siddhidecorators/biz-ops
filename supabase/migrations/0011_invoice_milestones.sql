-- =====================================================================
-- SmallBiz Ops — 0011 invoice payment schedule (milestones)
-- 2026-05-31
--
-- Adds an OPTIONAL ordered payment schedule to an invoice so a business can
-- agree "50% advance, 50% on completion" and track progress against it.
--
-- Design: this is a SOFT overlay on top of the existing single tax invoice +
-- payments ledger. It does NOT change GST, totals, or how payments are
-- recorded. Milestones are settled greedily by cumulative amount_paid (no
-- per-payment linkage), so the recalc_invoice_payment_status trigger and the
-- payments table are untouched. An invoice with NO milestone rows behaves
-- exactly as before (one balance due).
--
-- RLS: scoped through the parent invoice, mirroring invoice_lines / payments.
-- =====================================================================

create table public.invoice_milestones (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  label text not null,
  percent numeric(5, 2),                          -- optional, for display ("50%")
  amount numeric(14, 2) not null check (amount >= 0),
  due_date date,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index invoice_milestones_invoice_id_idx
  on public.invoice_milestones (invoice_id);

alter table public.invoice_milestones enable row level security;

create policy invoice_milestones_all on public.invoice_milestones
  for all
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id and i.org_id = public.current_org_id()
    )
  )
  with check (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id and i.org_id = public.current_org_id()
    )
  );

-- =====================================================================
-- end of migration 0011_invoice_milestones
-- =====================================================================
