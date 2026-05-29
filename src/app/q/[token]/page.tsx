import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { formatINR, formatDateDMY, round2 } from '@/lib/format';
import { UNIT_LABELS, type Unit } from '@/lib/enums';
import { QuoteResponse } from './quote-response';

export const metadata = { title: 'Quote' };

type SharedLine = {
  description: string;
  hsn_sac_code: string | null;
  unit: Unit;
  quantity: number | string;
  rate: number | string;
  tax_rate_percent: number | string;
  line_total: number | string;
};

type SharedQuote = {
  quote: {
    quote_number: string;
    status: string;
    issue_date: string;
    valid_until: string;
    project_label: string | null;
    notes: string | null;
    subtotal: number | string;
    tax_total: number | string;
    round_off: number | string;
    total: number | string;
    place_of_supply_state: string | null;
  };
  org: {
    name: string;
    logo_url: string | null;
    gstin: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    phone: string | null;
    email: string | null;
    brand_color: string | null;
    terms_text: string | null;
  };
  customer: { name: string } | null;
  lines: SharedLine[];
};

async function fetchSharedQuote(token: string): Promise<SharedQuote | null> {
  // Anonymous read via the token-scoped SECURITY DEFINER RPC. No session needed.
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  // A malformed token (not a uuid) makes the RPC error — treat as not found.
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data, error } = await supabase.rpc('get_shared_quote', { p_token: token });
  if (error || !data) return null;
  return data as SharedQuote;
}

export default async function SharedQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await fetchSharedQuote(token);

  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold">Quote not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This link may be incorrect or the quote may have been removed. Please
          ask the sender for an updated link.
        </p>
      </main>
    );
  }

  const { quote, org, customer, lines } = data;
  const brand = org.brand_color || '#B8552A';

  const isIntraState =
    !!org.state && !!quote.place_of_supply_state && org.state === quote.place_of_supply_state;
  const taxTotal = Number(quote.tax_total);
  const cgst = isIntraState ? round2(taxTotal / 2) : 0;
  const igst = isIntraState ? 0 : taxTotal;

  const orgAddress = [
    org.address_line1,
    org.address_line2,
    [org.city, org.state, org.pincode].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join(', ');

  const expired = quote.status === 'expired';

  return (
    <main className="mx-auto max-w-xl px-5 py-8 sm:py-12">
      {/* Business header */}
      <header className="flex items-start gap-4">
        {org.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={org.logo_url}
            alt={org.name}
            className="size-14 rounded-lg object-contain"
          />
        ) : (
          <div
            className="grid size-14 shrink-0 place-items-center rounded-lg text-xl font-semibold text-white"
            style={{ backgroundColor: brand }}
          >
            {org.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl leading-tight font-semibold">{org.name}</h1>
          {orgAddress && <p className="mt-0.5 text-xs text-muted-foreground">{orgAddress}</p>}
          <p className="text-xs text-muted-foreground">
            {[org.phone, org.email].filter(Boolean).join(' · ')}
          </p>
          {org.gstin && <p className="text-xs text-muted-foreground">GSTIN: {org.gstin}</p>}
        </div>
      </header>

      <div className="my-5 h-1 rounded-full" style={{ backgroundColor: brand }} />

      {/* Quote heading */}
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Quotation
          </p>
          <p className="text-lg font-semibold">{quote.quote_number}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>Date: {formatDateDMY(quote.issue_date)}</p>
          <p>Valid till: {formatDateDMY(quote.valid_until)}</p>
        </div>
      </div>

      {customer && (
        <p className="mt-3 text-sm">
          <span className="text-muted-foreground">Prepared for </span>
          <span className="font-medium">{customer.name}</span>
          {quote.project_label ? ` · ${quote.project_label}` : ''}
        </p>
      )}

      {expired && (
        <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          This quote has expired. Please ask for a fresh quote.
        </p>
      )}

      {/* Line items */}
      <div className="mt-6 overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <ul className="divide-y divide-border">
          {lines.map((l, i) => (
            <li key={i} className="px-4 py-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{l.description}</span>
                <span className="shrink-0 font-medium">{formatINR(l.line_total)}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {Number(l.quantity)} {UNIT_LABELS[l.unit]} × {formatINR(l.rate)}
                {Number(l.tax_rate_percent) > 0 && ` · GST ${Number(l.tax_rate_percent)}%`}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* Totals */}
      <div className="mt-4 space-y-1.5 text-sm">
        <Row label="Subtotal" value={Number(quote.subtotal)} muted />
        {isIntraState ? (
          <>
            <Row label="CGST" value={cgst} muted />
            <Row label="SGST" value={cgst} muted />
          </>
        ) : (
          <Row label="IGST" value={igst} muted />
        )}
        {Math.abs(Number(quote.round_off)) > 0 && (
          <Row label="Round off" value={Number(quote.round_off)} muted />
        )}
        <div className="mt-1 flex items-baseline justify-between border-t border-border pt-2 text-base font-semibold">
          <span>Total</span>
          <span style={{ color: brand }}>{formatINR(quote.total)}</span>
        </div>
      </div>

      {quote.notes && (
        <div className="mt-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Notes
          </p>
          <p className="mt-1 whitespace-pre-line text-sm">{quote.notes}</p>
        </div>
      )}

      {org.terms_text && (
        <div className="mt-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Terms &amp; conditions
          </p>
          <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">
            {org.terms_text}
          </p>
        </div>
      )}

      {/* Accept / decline */}
      <div className="mt-8">
        <QuoteResponse token={token} initialStatus={quote.status} brandColor={brand} />
      </div>

      <p className="mt-10 text-center text-[11px] text-muted-foreground">
        Powered by SmallBiz Ops
      </p>
    </main>
  );
}

function Row({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={'flex items-baseline justify-between' + (muted ? ' text-muted-foreground' : '')}>
      <span>{label}</span>
      <span>{formatINR(value)}</span>
    </div>
  );
}
