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
import { PlusIcon } from 'lucide-react';
import { formatINR, formatDateDMY, round2 } from '@/lib/format';
import { cn } from '@/lib/utils';
import { fetchExpensesForInvoice } from '@/lib/queries/expenses';
import { fetchCreditNotesForInvoice } from '@/lib/queries/credit-notes';
import { CreditNoteDialog } from '../_components/credit-note-dialog';
import { AppBar } from '../../_components/app-bar';
import { PdfDownloadButtons } from '../../quotes/_components/pdf-download-button';
import type { QuotePdfData } from '../../quotes/_components/quote-pdf';
import { STATE_BY_CODE } from '@/lib/india';
import { PaymentsLedger } from '../_components/payments-ledger';
import { InvoiceMoneyHero, InvoiceActions } from '../_components/invoice-money-hero';
import { PaymentSchedule } from '../_components/payment-schedule';
import type { PaymentRow } from '@/lib/queries/payments';
import type { MilestoneRow } from '@/lib/milestones';

export const metadata = { title: 'Invoice' };

type InvoiceRow = {
  id: string;
  share_token: string;
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

  const [invoiceRes, linesRes, paymentsRes, milestonesRes, orgRes, expensesList, creditNotes] = await Promise.all([
    supabase
      .from('invoices')
      .select(
        `id, share_token, invoice_number, status, payment_status, issue_date, project_label, notes, terms_text,
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
    supabase
      .from('invoice_milestones')
      .select('id, label, percent, amount, due_date, sort_order')
      .eq('invoice_id', id)
      .order('sort_order')
      .returns<MilestoneRow[]>(),
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
    fetchExpensesForInvoice(id, supabase).catch(() => []),
    fetchCreditNotesForInvoice(id, supabase).catch(() => []),
  ]);

  const invoice = invoiceRes.data;
  if (!invoice) notFound();

  const lines = linesRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const milestones = milestonesRes.data ?? [];
  const org = orgRes.data ?? null;
  const isIntraState = invoice.gst_type === 'intra_state';

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
        <InvoiceMoneyHero
          invoiceId={invoice.id}
          invoiceTotal={Number(invoice.total)}
          issueDate={invoice.issue_date}
          gstType={invoice.gst_type}
          milestones={milestones}
          initialPayments={payments}
        />

        <InvoiceActions
          invoiceId={invoice.id}
          invoiceTotal={Number(invoice.total)}
          invoiceNumber={invoice.invoice_number}
          shareToken={invoice.share_token}
          customerName={invoice.customers?.name ?? null}
          orgName={org?.name ?? null}
          milestones={milestones}
          pdfData={
            org && invoice.customers
              ? buildInvoicePdfData({ invoice, lines, milestones, org, isIntraState })
              : null
          }
          initialPayments={payments}
        />

        <PaymentSchedule
          invoiceId={invoice.id}
          invoiceTotal={Number(invoice.total)}
          milestones={milestones}
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
          </CardContent>
        </Card>

        {(() => {
          const costs = round2(expensesList.reduce((s, e) => s + Number(e.amount), 0));
          const revenue = Number(invoice.total);
          const profit = round2(revenue - costs);
          const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
          return (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Costs &amp; profit</CardTitle>
                  <Link
                    href={`/expenses/new?invoice=${invoice.id}`}
                    className="-mr-1 inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm font-medium text-primary transition-colors hover:bg-muted"
                  >
                    <PlusIcon className="size-3.5" /> Add cost
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {costs > 0 ? (
                  <>
                    <Row label="Invoice value" value={revenue} />
                    <Row label="Costs logged" value={costs} muted />
                    <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2">
                      <span className="font-semibold">
                        Profit{' '}
                        {revenue > 0 && (
                          <span className="text-xs font-normal text-muted-foreground">
                            ({margin}%)
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          'font-semibold',
                          profit >= 0 ? 'text-success-strong' : 'text-destructive',
                        )}
                      >
                        {formatINR(profit)}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    No costs logged yet. Add materials, labour and transport to see your profit on
                    this job.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })()}

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

        {creditNotes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Credit notes</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <ul className="divide-y divide-border">
                {creditNotes.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/credit-notes/${c.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {c.credit_note_number}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {c.reason || 'Credit note'} · {formatDateDMY(c.issue_date)}
                        </span>
                      </span>
                      <span className="tabular shrink-0 text-sm font-semibold text-destructive">
                        − {formatINR(c.total)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <PaymentsLedger invoiceId={invoice.id} initialPayments={payments} />

        <div className="space-y-3 pt-2">
          {org && invoice.customers && (
            <PdfDownloadButtons
              data={buildInvoicePdfData({ invoice, lines, milestones, org, isIntraState })}
            />
          )}
          <CreditNoteDialog
            invoiceId={invoice.id}
            invoiceNumber={invoice.invoice_number}
            isCancelled={invoice.status === 'cancelled'}
          />
          {invoice.quote_id && (
            <div className="pt-1 text-center">
              <Link
                href={`/quotes/${invoice.quote_id}`}
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                View source quote
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function buildInvoicePdfData({
  invoice,
  lines,
  milestones,
  org,
  isIntraState,
}: {
  invoice: InvoiceRow;
  lines: InvoiceLineRow[];
  milestones: MilestoneRow[];
  org: OrgForPdf;
  isIntraState: boolean;
}): QuotePdfData {
  const pos = invoice.place_of_supply_state;
  return {
    doc_type: 'TAX INVOICE',
    doc_number: invoice.invoice_number,
    issue_date: invoice.issue_date,
    reverse_charge: false,
    watermark:
      invoice.status === 'cancelled'
        ? 'CANCELLED'
        : invoice.payment_status === 'paid'
          ? 'PAID'
          : invoice.status === 'draft'
            ? 'DRAFT'
            : null,
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
    payment_schedule: milestones.map((m) => ({
      label: m.label,
      amount: Number(m.amount),
      due_date: m.due_date,
      percent: m.percent == null ? null : Number(m.percent),
    })),
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
