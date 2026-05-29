import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { formatINR, formatDateDMY } from '@/lib/format';
import { UNIT_LABELS, type Unit, type PaymentStatus } from '@/lib/enums';

export const metadata = { title: 'Invoice' };

type SharedLine = {
  description: string;
  unit: Unit;
  quantity: number | string;
  rate: number | string;
  tax_rate_percent: number | string;
  line_total: number | string;
};

type SharedInvoice = {
  invoice: {
    invoice_number: string;
    status: string;
    payment_status: PaymentStatus;
    issue_date: string;
    project_label: string | null;
    notes: string | null;
    subtotal: number | string;
    tax_total: number | string;
    round_off: number | string;
    total: number | string;
    amount_paid: number | string;
    amount_due: number | string;
    gst_type: string;
    cgst_total: number | string;
    sgst_total: number | string;
    igst_total: number | string;
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
    upi_id: string | null;
    bank_account_name: string | null;
    bank_account_number: string | null;
    bank_ifsc: string | null;
    bank_name: string | null;
  };
  customer: { name: string } | null;
  lines: SharedLine[];
};

async function fetchSharedInvoice(token: string): Promise<SharedInvoice | null> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data, error } = await supabase.rpc('get_shared_invoice', { p_token: token });
  if (error || !data) return null;
  return data as SharedInvoice;
}

export default async function SharedInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await fetchSharedInvoice(token);

  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold">Invoice not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This link may be incorrect or the invoice may have been removed. Please
          ask the sender for an updated link.
        </p>
      </main>
    );
  }

  const { invoice, org, customer, lines } = data;
  const brand = org.brand_color || '#B8552A';
  const isIntra = invoice.gst_type === 'intra_state';
  const due = Number(invoice.amount_due);
  const paid = invoice.payment_status === 'paid' || due <= 0.0099;

  const orgAddress = [
    org.address_line1,
    org.address_line2,
    [org.city, org.state, org.pincode].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join(', ');

  const upiLink =
    org.upi_id && due > 0
      ? `upi://pay?pa=${encodeURIComponent(org.upi_id)}&pn=${encodeURIComponent(
          org.name,
        )}&am=${due.toFixed(2)}&cu=INR&tn=${encodeURIComponent(invoice.invoice_number)}`
      : null;

  const hasBank =
    org.bank_account_number || org.bank_account_name || org.bank_ifsc || org.bank_name;

  return (
    <main className="mx-auto max-w-xl px-5 py-8 sm:py-12">
      <header className="flex items-start gap-4">
        {org.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.logo_url} alt={org.name} className="size-14 rounded-lg object-contain" />
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

      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Tax Invoice
          </p>
          <p className="text-lg font-semibold">{invoice.invoice_number}</p>
        </div>
        <p className="text-right text-xs text-muted-foreground">
          Date: {formatDateDMY(invoice.issue_date)}
        </p>
      </div>

      {customer && (
        <p className="mt-3 text-sm">
          <span className="text-muted-foreground">Billed to </span>
          <span className="font-medium">{customer.name}</span>
          {invoice.project_label ? ` · ${invoice.project_label}` : ''}
        </p>
      )}

      {/* Balance due banner */}
      {paid ? (
        <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-center">
          <p className="text-base font-semibold text-emerald-700">✓ Paid in full</p>
        </div>
      ) : (
        <div className="mt-5 rounded-xl px-4 py-4 text-center text-white" style={{ backgroundColor: brand }}>
          <p className="text-xs uppercase tracking-wide opacity-90">Amount due</p>
          <p className="text-3xl font-bold">{formatINR(due)}</p>
        </div>
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
        <Row label="Subtotal" value={Number(invoice.subtotal)} muted />
        {isIntra ? (
          <>
            <Row label="CGST" value={Number(invoice.cgst_total)} muted />
            <Row label="SGST" value={Number(invoice.sgst_total)} muted />
          </>
        ) : (
          <Row label="IGST" value={Number(invoice.igst_total)} muted />
        )}
        {Math.abs(Number(invoice.round_off)) > 0 && (
          <Row label="Round off" value={Number(invoice.round_off)} muted />
        )}
        <div className="mt-1 flex items-baseline justify-between border-t border-border pt-2 text-base font-semibold">
          <span>Total</span>
          <span>{formatINR(invoice.total)}</span>
        </div>
        {Number(invoice.amount_paid) > 0 && (
          <>
            <Row label="Paid" value={Number(invoice.amount_paid)} muted />
            <div className="flex items-baseline justify-between text-base font-semibold">
              <span>Balance due</span>
              <span style={{ color: brand }}>{formatINR(due)}</span>
            </div>
          </>
        )}
      </div>

      {/* How to pay */}
      {!paid && (upiLink || hasBank) && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            How to pay
          </p>
          {upiLink && (
            <a
              href={upiLink}
              className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: brand }}
            >
              Pay {formatINR(due)} via UPI
            </a>
          )}
          {org.upi_id && (
            <p className="mt-2 text-xs text-muted-foreground">
              UPI ID: <span className="font-medium text-foreground">{org.upi_id}</span>
            </p>
          )}
          {hasBank && (
            <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {org.bank_account_name && <p>A/c name: {org.bank_account_name}</p>}
              {org.bank_account_number && <p>A/c no: {org.bank_account_number}</p>}
              {org.bank_ifsc && <p>IFSC: {org.bank_ifsc}</p>}
              {org.bank_name && <p>Bank: {org.bank_name}</p>}
            </div>
          )}
        </div>
      )}

      {invoice.notes && (
        <div className="mt-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Notes
          </p>
          <p className="mt-1 whitespace-pre-line text-sm">{invoice.notes}</p>
        </div>
      )}

      <p className="mt-10 text-center text-[11px] text-muted-foreground">Powered by SmallBiz Ops</p>
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
