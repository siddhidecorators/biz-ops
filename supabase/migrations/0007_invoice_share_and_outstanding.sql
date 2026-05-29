-- =====================================================================
-- Phase 2 feature — get-paid tools
-- =====================================================================
-- 1. Public, token-gated invoice view (mirrors the quote share links), so a
--    customer can open a WhatsApp reminder, see the balance due, and see how
--    to pay (UPI / bank details).
-- 2. Dashboard now also returns total ₹ outstanding.

alter table public.invoices
  add column if not exists share_token uuid not null default gen_random_uuid();

create unique index if not exists invoices_share_token_idx
  on public.invoices (share_token);

-- Token-scoped public read of a single invoice. Exposes the business's own
-- branding + payment details (UPI/bank) so the customer can pay, plus the
-- customer's name. No other invoices are reachable.
create or replace function public.get_shared_invoice(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'invoice', jsonb_build_object(
      'invoice_number', i.invoice_number,
      'status', i.status,
      'payment_status', i.payment_status,
      'issue_date', i.issue_date,
      'project_label', i.project_label,
      'notes', i.notes,
      'subtotal', i.subtotal,
      'tax_total', i.tax_total,
      'round_off', i.round_off,
      'total', i.total,
      'amount_paid', i.amount_paid,
      'amount_due', i.amount_due,
      'gst_type', i.gst_type,
      'cgst_total', i.cgst_total,
      'sgst_total', i.sgst_total,
      'igst_total', i.igst_total
    ),
    'org', jsonb_build_object(
      'name', o.name, 'logo_url', o.logo_url, 'gstin', o.gstin,
      'address_line1', o.address_line1, 'address_line2', o.address_line2,
      'city', o.city, 'state', o.state, 'pincode', o.pincode,
      'phone', o.phone, 'email', o.email, 'brand_color', o.brand_color,
      'terms_text', o.terms_text,
      'upi_id', o.upi_id, 'bank_account_name', o.bank_account_name,
      'bank_account_number', o.bank_account_number, 'bank_ifsc', o.bank_ifsc,
      'bank_name', o.bank_name
    ),
    'customer', case when c.id is null then null
                     else jsonb_build_object('name', c.name) end,
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', l.description, 'hsn_sac_code', l.hsn_sac_code,
        'unit', l.unit, 'quantity', l.quantity, 'rate', l.rate,
        'tax_rate_percent', l.tax_rate_percent, 'line_total', l.line_total
      ) order by l.sort_order)
      from public.invoice_lines l where l.invoice_id = i.id
    ), '[]'::jsonb)
  )
  from public.invoices i
  join public.orgs o on o.id = i.org_id
  left join public.customers c on c.id = i.customer_id
  where i.share_token = p_token;
$$;

grant execute on function public.get_shared_invoice(uuid) to anon, authenticated;

-- Dashboard counts now also return total outstanding (sum of balance due on
-- unpaid/partial invoices). Return signature changes, so drop + recreate.
drop function if exists public.get_dashboard_counts();
create function public.get_dashboard_counts()
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
    (select count(*)::bigint from public.invoices where payment_status in ('unpaid','partial')),
    (select coalesce(sum(amount_due), 0)::numeric from public.invoices where payment_status in ('unpaid','partial'));
$$;

grant execute on function public.get_dashboard_counts() to authenticated;
