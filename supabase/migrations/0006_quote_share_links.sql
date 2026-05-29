-- =====================================================================
-- Phase 2 feature — customer-facing quote share links
-- =====================================================================
-- Each quote gets an unguessable share_token. Anonymous visitors who have
-- the token (i.e. the link the owner WhatsApps them) can read ONLY that one
-- quote and accept/decline it, via SECURITY DEFINER functions that return
-- sanitized data. No broad RLS hole: anon can't list or read quotes
-- directly — only through these token-scoped functions.

alter table public.quotes
  add column if not exists share_token uuid not null default gen_random_uuid();

create unique index if not exists quotes_share_token_idx
  on public.quotes (share_token);

-- Public, read-only view of a single quote by token. Returns null if the
-- token doesn't match. Exposes the business's own branding/contact (which
-- already appears on the quote) and the customer's name only.
create or replace function public.get_shared_quote(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'quote', jsonb_build_object(
      'quote_number', q.quote_number,
      'status', q.status,
      'issue_date', q.issue_date,
      'valid_until', q.valid_until,
      'project_label', q.project_label,
      'notes', q.notes,
      'subtotal', q.subtotal,
      'tax_total', q.tax_total,
      'round_off', q.round_off,
      'total', q.total,
      'place_of_supply_state', q.place_of_supply_state,
      'install_address_line1', q.install_address_line1,
      'install_address_line2', q.install_address_line2,
      'install_city', q.install_city,
      'install_state', q.install_state,
      'install_pincode', q.install_pincode
    ),
    'org', jsonb_build_object(
      'name', o.name, 'logo_url', o.logo_url, 'gstin', o.gstin,
      'address_line1', o.address_line1, 'address_line2', o.address_line2,
      'city', o.city, 'state', o.state, 'pincode', o.pincode,
      'phone', o.phone, 'email', o.email, 'brand_color', o.brand_color,
      'terms_text', o.terms_text
    ),
    'customer', case when c.id is null then null
                     else jsonb_build_object('name', c.name) end,
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', l.description, 'hsn_sac_code', l.hsn_sac_code,
        'unit', l.unit, 'quantity', l.quantity, 'rate', l.rate,
        'tax_rate_percent', l.tax_rate_percent, 'amount', l.amount,
        'tax_amount', l.tax_amount, 'line_total', l.line_total
      ) order by l.sort_order)
      from public.quote_lines l where l.quote_id = q.id
    ), '[]'::jsonb)
  )
  from public.quotes q
  join public.orgs o on o.id = q.org_id
  left join public.customers c on c.id = q.customer_id
  where q.share_token = p_token;
$$;

grant execute on function public.get_shared_quote(uuid) to anon, authenticated;

-- Customer accepts or declines. Only legal from draft/sent/declined; never
-- touches a converted/accepted quote. Returns the resulting state string.
create or replace function public.respond_to_shared_quote(p_token uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_status quote_status;
begin
  select id, status into v_id, v_status
  from public.quotes where share_token = p_token;

  if v_id is null then return 'not_found'; end if;
  if v_status in ('accepted', 'converted_to_invoice') then return 'already_accepted'; end if;
  if v_status not in ('draft', 'sent', 'declined') then return 'locked'; end if;

  update public.quotes
    set status = case when p_accept then 'accepted'::quote_status else 'declined'::quote_status end
    where id = v_id;

  return case when p_accept then 'accepted' else 'declined' end;
end;
$$;

grant execute on function public.respond_to_shared_quote(uuid, boolean) to anon, authenticated;
