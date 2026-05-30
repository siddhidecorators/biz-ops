-- =====================================================================
-- Feature — customer statements (shareable "what you owe" summary)
-- =====================================================================
-- Each customer gets an unguessable share_token. A token-scoped SECURITY
-- DEFINER function returns that customer's invoices + total due + the
-- business's payment details, so the owner can WhatsApp a running statement
-- and the customer can see (and pay) what's outstanding.

alter table public.customers
  add column if not exists share_token uuid not null default gen_random_uuid();

create unique index if not exists customers_share_token_idx
  on public.customers (share_token);

create or replace function public.get_customer_statement(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'org', jsonb_build_object(
      'name', o.name, 'logo_url', o.logo_url, 'brand_color', o.brand_color,
      'phone', o.phone, 'email', o.email, 'upi_id', o.upi_id,
      'bank_account_name', o.bank_account_name,
      'bank_account_number', o.bank_account_number,
      'bank_ifsc', o.bank_ifsc, 'bank_name', o.bank_name
    ),
    'customer', jsonb_build_object('name', c.name),
    'invoices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'invoice_number', i.invoice_number, 'issue_date', i.issue_date,
        'total', i.total, 'amount_paid', i.amount_paid,
        'amount_due', i.amount_due, 'payment_status', i.payment_status,
        'share_token', i.share_token
      ) order by i.issue_date desc)
      from public.invoices i where i.customer_id = c.id
    ), '[]'::jsonb),
    'total_due', coalesce(
      (select sum(amount_due) from public.invoices where customer_id = c.id), 0
    )
  )
  from public.customers c
  join public.orgs o on o.id = c.org_id
  where c.share_token = p_token;
$$;

grant execute on function public.get_customer_statement(uuid) to anon, authenticated;
