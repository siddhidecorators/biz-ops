import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  UNIT_LABELS,
  type GstType,
  type InvoiceStatus,
  type PaymentStatus,
  type Unit,
} from '@/lib/enums';
import { formatINR, formatDateDMY } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AppBar } from '../../_components/app-bar';
import { PdfDownloadButtons } from '../../quotes/_components/pdf-download-button';
import type { QuotePdfData } from '../../quotes/_components/quote-pdf';
import { STATE_BY_CODE } from '@/lib/india';
import { RecordPaymentDialog } from '../_components/record-payment-dialog';
import { PaymentsLedger } from '../_components/payments-ledger';
import {
  InvoiceStatusPill,
  InvoicePaidDueRows,
  InvoicePaidInFullBanner,
} from '../_components/invoice-status-block';
import type { PaymentRow } from '@/lib/queries/payments';
import { deriveInvoicePaymentState } from '@/lib/queries/payments';

export const metadata = { title: 'Invoice' };

type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  payment_status: PaymentStatus;
  issue_date: string;
  project_label: string | null;
  notes: string | null;
  terms_text: string | null;
  subtotal: number | string;
  tax_total: number | string;
  round_off: number | string;
  total: number | string;
  amount_paid: number | string;
  amount_due: number | string;
  place_of_supply_state: string | null;
  gst_type: GstType;
  cgst_total: number | string;
  sgst_total: number | string;
  igst_total: number | string;
  install_address_line1: string | null;
  install_address_line2: string | null;
  install_city: string | null;
  install_state: string | null;
  install_pincode: string | null;
  quote_id: string | null;
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

type InvoiceLineRow = {
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
  cgst_amount: number | string;
  sgst_amount: number | string;
  igst_amount: number | string;
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

export default async function InvoiceDetailPage({
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

  const [invoiceRes, linesRes, paymentsRes, orgRes] = await Promise.all([
    supabase
      .from('invoices')
      .select(
        `id, invoice_number, status, payment_status, issue_date, project_label, notes, terms_text,
         subtotal, tax_total, round_off, total, amount_paid, amount_due,
         place_of_supply_state, gst_type, cgst_total, sgst_total, igst_total,
         install_address_line1, install_address_line2, install_city, install_state, install_pincode, quote_id,
         customers(id, name, phone, email, gstin, customer_type,
                   billing_address_line1, billing_address_line2, billing_city, billing_state, billing_pincode)`,
      )
      .eq('id', id)
      .maybeSingle<InvoiceRow>(),
    supabase
      .from('invoice_lines')
      .select(
        'id, description, hsn_sac_code, unit, quantity, rate, tax_rate_percent, amount, tax_amount, line_total, cgst_amount, sgst_amount, igst_amount, sort_order',
      )
      .eq('invoice_id', id)
      .order('sort_order')
      .returns<InvoiceLineRow[]>(),
    supabase
      .from('payments')
      .select('id, amount, payment_date, mode, reference, notes')
      .eq('invoice_id', id)
      .order('payment_date', { ascending: false })
      .returns<PaymentRow[]>(),
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

  const invoice = invoiceRes.data;
  if (!invoice) notFound();

  const lines = linesRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const org = orgRes.data ?? null;
  const isIntraState = invoice.gst_type === 'intra_state';

  // Compute initial paid/due/status from the seeded payments. Client components
  // hydrate the cache with these values, then keep them in sync via useQuery
  // and optimistic mutations.
  const initialDerived = deriveInvoicePaymentState(payments, Number(invoice.total));

  const billingAddress = invoice.customers
    ? [
        invoice.customers.billing_address_line1,
        invoice.customers.billing_address_line2,
        [
          invoice.customers.billing_city,
          invoice.customers.billing_state,
          invoice.customers.billing_pincode,
        ]
          .filter(Boolean)
          .join(', '),
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const installAddress = [
    invoice.install_address_line1,
    invoice.install_address_line2,
    [invoice.install_city, invoice.install_state, invoice.install_pincode]
      .filter(Boolean)
      .join(', '),
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <>
      <AppBar
        title={invoice.invoice_number}
        subtitle={invoice.customers?.name ?? 'Invoice'}
        back={{ href: '/invoices' }}
      />
      <main className="mx-auto max-w-md space-y-4 px-6 py-5">
        <InvoiceStatusPill
          invoiceId={invoice.id}
          invoiceTotal={Number(invoice.total)}
          issueDate={invoice.issue_date}
          gstType={invoice.gst_type}
          initial={initialDerived}
          initialPayments={payments}
        />

        {invoice.customers && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{invoice.customers.name}</CardTitle>
              {invoice.project_label && (
                <p className="text-xs text-muted-foreground">{invoice.project_label}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                {invoice.customers.phone}
                {invoice.customers.email && ` · ${invoice.customers.email}`}
              </p>
              {invoice.customers.gstin && (
                <p className="text-xs text-muted-foreground">GSTIN: {invoice.customers.gstin}</p>
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
          <CardContent className="px-0">
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
            <Row label="Subtotal" value={Number(invoice.subtotal)} />
            {isIntraState ? (
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
            <div className="mt-2 border-t border-border pt-2">
              <Row label="Total" value={Number(invoice.total)} emphasize />
            </div>
            <InvoicePaidDueRows
              invoiceId={invoice.id}
              invoiceTotal={Number(invoice.total)}
              initial={initialDerived}
              initialPayments={payments}
            />
          </CardContent>
        </Card>

        {invoice.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm">{invoice.notes}</p>
            </CardContent>
          </Card>
        )}

        <PaymentsLedger invoiceId={invoice.id} initialPayments={payments} />

        <div className="space-y-3 pt-2">
          <RecordPaymentDialog
            invoiceId={invoice.id}
            invoiceTotal={Number(invoice.total)}
            invoiceNumber={invoice.invoice_number}
          />
          <InvoicePaidInFullBanner
            invoiceId={invoice.id}
            invoiceTotal={Number(invoice.total)}
            initialPayments={payments}
          />
          {org && invoice.customers && (
            <PdfDownloadButtons
              data={buildInvoicePdfData({ invoice, lines, org, isIntraState })}
            />
          )}
          {invoice.quote_id && (
            <Link
              href={`/quotes/${invoice.quote_id}`}
              className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted"
            >
              View source quote
            </Link>
          )}
        </div>
      </main>
    </>
  );
}

function buildInvoicePdfData({
  invoice,
  lines,
  org,
  isIntraState,
}: {
  invoice: InvoiceRow;
  lines: InvoiceLineRow[];
  org: OrgForPdf;
  isIntraState: boolean;
}): QuotePdfData {
  const pos = invoice.place_of_supply_state;
  return {
    doc_type: 'TAX INVOICE',
    doc_number: invoice.invoice_number,
    issue_date: invoice.issue_date,
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
    customer: invoice.customers
      ? {
          name: invoice.customers.name,
          phone: invoice.customers.phone,
          email: invoice.customers.email,
          gstin: invoice.customers.gstin,
          billing_address_line1: invoice.customers.billing_address_line1,
          billing_address_line2: invoice.customers.billing_address_line2,
          billing_city: invoice.customers.billing_city,
          billing_state: invoice.customers.billing_state,
          billing_pincode: invoice.customers.billing_pincode,
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
      address_line1: invoice.install_address_line1,
      address_line2: invoice.install_address_line2,
      city: invoice.install_city,
      state: invoice.install_state,
      pincode: invoice.install_pincode,
    },
    project_label: invoice.project_label,
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
      subtotal: Number(invoice.subtotal),
      tax_total: Number(invoice.tax_total),
      cgst: Number(invoice.cgst_total),
      sgst: Number(invoice.sgst_total),
      igst: Number(invoice.igst_total),
      round_off: Number(invoice.round_off),
      total: Number(invoice.total),
      amount_paid: Number(invoice.amount_paid),
      amount_due: Number(invoice.amount_due),
    },
    notes: invoice.notes,
    terms_text: invoice.terms_text ?? org.terms_text,
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
