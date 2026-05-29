import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  QUOTE_STATUS_LABELS,
  UNIT_LABELS,
  type QuoteStatus,
  type Unit,
} from '@/lib/enums';
import { formatINR, formatDateDMY, round2 } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AppBar } from '../../_components/app-bar';
import { DeleteQuoteButton } from '../_components/delete-button';
import { QuoteActions } from '../_components/quote-actions';
import { PdfDownloadButtons } from '../_components/pdf-download-button';
import { ShareQuoteButton } from '../_components/share-quote-button';
import type { QuotePdfData } from '../_components/quote-pdf';
import { STATE_BY_CODE } from '@/lib/india';

export const metadata = { title: 'Quote' };

type QuoteRow = {
  id: string;
  share_token: string;
  quote_number: string;
  status: QuoteStatus;
  invoice_id: string | null;
  issue_date: string;
  valid_until: string;
  project_label: string | null;
  notes: string | null;
  subtotal: number | string;
  tax_total: number | string;
  round_off: number | string;
  total: number | string;
  place_of_supply_state: string | null;
  install_address_line1: string | null;
  install_address_line2: string | null;
  install_city: string | null;
  install_state: string | null;
  install_pincode: string | null;
  customers: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    gstin: string | null;
    customer_type: string;
    billing_address_line1: string | null;
    billing_address_line2: string | null;
    billing_city: string | null;
    billing_state: string | null;
    billing_pincode: string | null;
  } | null;
};

type QuoteLineRow = {
  id: string;
  description: string;
  hsn_sac_code: string | null;
  unit: Unit;
  quantity: number | string;
  rate: number | string;
  tax_rate_percent: number | string;
  amount: number | string;
  tax_amount: number | string;
  line_total: number | string;
  sort_order: number;
};

type OrgForPdf = {
  name: string;
  logo_url: string | null;
  gstin: string | null;
  pan: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  signatory_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  upi_id: string | null;
  terms_text: string | null;
};

const STATUS_STYLE: Record<QuoteStatus, string> = {
  draft: 'bg-muted text-muted-foreground ring-border',
  sent: 'bg-sky-500/10 text-sky-700 ring-sky-500/30 dark:text-sky-300',
  accepted: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
  declined: 'bg-rose-500/10 text-rose-700 ring-rose-500/30 dark:text-rose-300',
  converted_to_invoice: 'bg-brand-tint text-primary ring-primary/30',
  expired: 'bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300',
};

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const [quoteRes, linesRes, orgRes] = await Promise.all([
    supabase
      .from('quotes')
      .select(
        `id, share_token, quote_number, status, invoice_id, issue_date, valid_until, project_label, notes,
         subtotal, tax_total, round_off, total, place_of_supply_state,
         install_address_line1, install_address_line2, install_city, install_state, install_pincode,
         customers(id, name, phone, email, gstin, customer_type,
                   billing_address_line1, billing_address_line2, billing_city, billing_state, billing_pincode)`,
      )
      .eq('id', id)
      .maybeSingle<QuoteRow>(),
    supabase
      .from('quote_lines')
      .select(
        'id, description, hsn_sac_code, unit, quantity, rate, tax_rate_percent, amount, tax_amount, line_total, sort_order',
      )
      .eq('quote_id', id)
      .order('sort_order')
      .returns<QuoteLineRow[]>(),
    (async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .maybeSingle<{ org_id: string }>();
      if (!profile) return { data: null };
      return supabase
        .from('orgs')
        .select(
          'name, logo_url, gstin, pan, address_line1, address_line2, city, state, pincode, phone, email, signatory_name, bank_account_name, bank_account_number, bank_ifsc, bank_name, upi_id, terms_text',
        )
        .eq('id', profile.org_id)
        .maybeSingle<OrgForPdf>();
    })(),
  ]);

  const quote = quoteRes.data;
  if (!quote) notFound();

  const lines = linesRes.data ?? [];
  const org = orgRes.data ?? null;
  const orgState = org?.state ?? null;
  const placeOfSupply =
    quote.place_of_supply_state ?? quote.customers?.billing_state ?? null;
  const isIntraState = !!orgState && !!placeOfSupply && orgState === placeOfSupply;

  // Recompute tax split from stored tax_total for the breakdown display
  const taxTotal = Number(quote.tax_total);
  const cgst = isIntraState ? round2(taxTotal / 2) : 0;
  const sgst = isIntraState ? round2(taxTotal / 2) : 0;
  const igst = isIntraState ? 0 : taxTotal;

  const installAddress = [
    quote.install_address_line1,
    quote.install_address_line2,
    [quote.install_city, quote.install_state, quote.install_pincode].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join('\n');

  const billingAddress = quote.customers
    ? [
        quote.customers.billing_address_line1,
        quote.customers.billing_address_line2,
        [
          quote.customers.billing_city,
          quote.customers.billing_state,
          quote.customers.billing_pincode,
        ]
          .filter(Boolean)
          .join(', '),
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  return (
    <>
      <AppBar
        title={quote.quote_number}
        subtitle={quote.customers?.name ?? 'Quote'}
        back={{ href: '/quotes' }}
      />
      <main className="mx-auto max-w-md space-y-4 px-6 py-5">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 font-medium uppercase tracking-wide ring-1',
              STATUS_STYLE[quote.status],
            )}
          >
            {QUOTE_STATUS_LABELS[quote.status]}
          </span>
          <span className="text-muted-foreground">
            Issued {formatDateDMY(quote.issue_date)} · Valid till {formatDateDMY(quote.valid_until)}
          </span>
        </div>

        {quote.customers && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{quote.customers.name}</CardTitle>
              {quote.project_label && (
                <p className="text-xs text-muted-foreground">{quote.project_label}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                {quote.customers.phone}
                {quote.customers.email && ` · ${quote.customers.email}`}
              </p>
              {quote.customers.gstin && (
                <p className="text-xs text-muted-foreground">GSTIN: {quote.customers.gstin}</p>
              )}
              {billingAddress && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Billed to
                  </p>
                  <p className="whitespace-pre-line">{billingAddress}</p>
                </div>
              )}
              {installAddress && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Site address
                  </p>
                  <p className="whitespace-pre-line">{installAddress}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Line items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-0">
            <ul className="divide-y divide-border">
              {lines.map((l, i) => (
                <li key={l.id} className="px-4 py-3 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="text-base font-medium">{formatINR(l.line_total)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm">{l.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Number(l.quantity)} {UNIT_LABELS[l.unit]} × {formatINR(l.rate)}
                    {Number(l.tax_rate_percent) > 0 &&
                      ` · GST ${Number(l.tax_rate_percent)}%`}
                    {l.hsn_sac_code && ` · HSN ${l.hsn_sac_code}`}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-brand-tint/30">
          <CardHeader>
            <CardTitle className="text-base">Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Subtotal" value={Number(quote.subtotal)} />
            {isIntraState ? (
              <>
                <Row label="CGST" value={cgst} muted />
                <Row label="SGST" value={sgst} muted />
              </>
            ) : (
              <Row label="IGST" value={igst} muted />
            )}
            {Math.abs(Number(quote.round_off)) > 0 && (
              <Row label="Round off" value={Number(quote.round_off)} muted />
            )}
            <div className="mt-2 border-t border-border pt-2">
              <Row label="Total" value={Number(quote.total)} emphasize />
            </div>
          </CardContent>
        </Card>

        {quote.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm">{quote.notes}</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2.5 pt-4">
          {/* Primary — send the quote to the customer */}
          {org && quote.status !== 'converted_to_invoice' && (
            <ShareQuoteButton
              shareToken={quote.share_token}
              customerPhone={quote.customers?.phone ?? null}
              customerName={quote.customers?.name ?? null}
              quoteNumber={quote.quote_number}
              orgName={org.name}
            />
          )}

          {/* Workflow — advance status / convert */}
          <QuoteActions
            quoteId={quote.id}
            status={quote.status}
            invoiceId={quote.invoice_id}
          />

          {/* Quiet — for the owner's own records */}
          {org && quote.customers && (
            <PdfDownloadButtons
              data={buildPdfData({
                quote,
                lines,
                org,
                isIntraState,
                taxSplit: { cgst, sgst, igst },
              })}
            />
          )}

          {/* Subtle — edit / delete */}
          {quote.status !== 'converted_to_invoice' && (
            <div className="flex items-center justify-center gap-5 pt-2">
              <Link
                href={`/quotes/${quote.id}/edit`}
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Edit
              </Link>
              <DeleteQuoteButton quoteId={quote.id} quoteNumber={quote.quote_number} />
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function buildPdfData({
  quote,
  lines,
  org,
  isIntraState,
  taxSplit,
}: {
  quote: QuoteRow;
  lines: QuoteLineRow[];
  org: OrgForPdf;
  isIntraState: boolean;
  taxSplit: { cgst: number; sgst: number; igst: number };
}): QuotePdfData {
  const pos = quote.place_of_supply_state ?? quote.customers?.billing_state ?? null;
  return {
    doc_type: 'QUOTATION',
    doc_number: quote.quote_number,
    issue_date: quote.issue_date,
    valid_until: quote.valid_until,
    reverse_charge: false,
    place_of_supply: pos ? STATE_BY_CODE[pos]?.name ?? pos : null,
    org: {
      name: org.name,
      logo_url: org.logo_url,
      gstin: org.gstin,
      pan: org.pan,
      address_line1: org.address_line1,
      address_line2: org.address_line2,
      city: org.city,
      state: org.state,
      pincode: org.pincode,
      phone: org.phone,
      email: org.email,
      signatory_name: org.signatory_name,
      bank_account_name: org.bank_account_name,
      bank_account_number: org.bank_account_number,
      bank_ifsc: org.bank_ifsc,
      bank_name: org.bank_name,
      upi_id: org.upi_id,
    },
    customer: quote.customers
      ? {
          name: quote.customers.name,
          phone: quote.customers.phone,
          email: quote.customers.email,
          gstin: quote.customers.gstin,
          billing_address_line1: quote.customers.billing_address_line1,
          billing_address_line2: quote.customers.billing_address_line2,
          billing_city: quote.customers.billing_city,
          billing_state: quote.customers.billing_state,
          billing_pincode: quote.customers.billing_pincode,
        }
      : {
          name: '—',
          phone: null,
          email: null,
          gstin: null,
          billing_address_line1: null,
          billing_address_line2: null,
          billing_city: null,
          billing_state: null,
          billing_pincode: null,
        },
    install: {
      address_line1: quote.install_address_line1,
      address_line2: quote.install_address_line2,
      city: quote.install_city,
      state: quote.install_state,
      pincode: quote.install_pincode,
    },
    project_label: quote.project_label,
    lines: lines.map((l) => ({
      description: l.description,
      hsn_sac_code: l.hsn_sac_code,
      unit: l.unit,
      quantity: Number(l.quantity),
      rate: Number(l.rate),
      tax_rate_percent: Number(l.tax_rate_percent),
      amount: Number(l.amount),
      tax_amount: Number(l.tax_amount),
      line_total: Number(l.line_total),
    })),
    isIntraState,
    totals: {
      subtotal: Number(quote.subtotal),
      tax_total: Number(quote.tax_total),
      cgst: taxSplit.cgst,
      sgst: taxSplit.sgst,
      igst: taxSplit.igst,
      round_off: Number(quote.round_off),
      total: Number(quote.total),
    },
    notes: quote.notes,
    terms_text: org.terms_text,
  };
}

function Row({
  label,
  value,
  muted,
  emphasize,
}: {
  label: string;
  value: number;
  muted?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between',
        muted && 'text-muted-foreground',
        emphasize && 'text-base font-semibold text-foreground',
      )}
    >
      <span>{label}</span>
      <span className={cn(emphasize && 'text-primary')}>{formatINR(value)}</span>
    </div>
  );
}
