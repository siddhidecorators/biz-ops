import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatINR, formatDateDMY, round2 } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AppBar } from '../../_components/app-bar';
import { PdfDownloadButtons } from '../../quotes/_components/pdf-download-button';
import type { QuotePdfData } from '../../quotes/_components/quote-pdf';
import { STATE_BY_CODE } from '@/lib/india';

export const metadata = { title: 'Credit note' };

type CreditNoteRow = {
  id: string;
  credit_note_number: string;
  issue_date: string;
  reason: string | null;
  subtotal: number | string;
  tax_total: number | string;
  round_off: number | string;
  total: number | string;
  place_of_supply_state: string | null;
  gst_type: 'intra_state' | 'inter_state';
  cgst_total: number | string;
  sgst_total: number | string;
  igst_total: number | string;
  invoice_id: string;
  invoices: { invoice_number: string } | null;
  customers: {
    name: string;
    phone: string | null;
    email: string | null;
    gstin: string | null;
    billing_address_line1: string | null;
    billing_address_line2: string | null;
    billing_city: string | null;
    billing_state: string | null;
    billing_pincode: string | null;
  } | null;
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

export default async function CreditNoteDetailPage({
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

  const [cnRes, orgRes] = await Promise.all([
    supabase
      .from('credit_notes')
      .select(
        `id, credit_note_number, issue_date, reason, subtotal, tax_total, round_off, total,
         place_of_supply_state, gst_type, cgst_total, sgst_total, igst_total, invoice_id,
         invoices(invoice_number),
         customers(name, phone, email, gstin, billing_address_line1, billing_address_line2,
                   billing_city, billing_state, billing_pincode)`,
      )
      .eq('id', id)
      .maybeSingle<CreditNoteRow>(),
    supabase
      .from('orgs')
      .select(
        'name, logo_url, gstin, pan, address_line1, address_line2, city, state, pincode, phone, email, signatory_name, bank_account_name, bank_account_number, bank_ifsc, bank_name, upi_id, terms_text',
      )
      .maybeSingle<OrgForPdf>(),
  ]);

  const cn = cnRes.data;
  if (!cn) notFound();
  const org = orgRes.data ?? null;
  const isIntra = cn.gst_type === 'intra_state';

  return (
    <>
      <AppBar
        title={cn.credit_note_number}
        subtitle="Credit note"
        back={{ href: cn.invoice_id ? `/invoices/${cn.invoice_id}` : '/invoices' }}
      />
      <main className="mx-auto max-w-md space-y-4 px-5 py-5">
        <Card className="bg-brand-tint/30">
          <CardHeader>
            <CardTitle className="text-base">Credit note</CardTitle>
            {cn.invoices?.invoice_number && (
              <p className="text-xs text-muted-foreground">
                Against invoice {cn.invoices.invoice_number} · {formatDateDMY(cn.issue_date)}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Taxable value" value={Number(cn.subtotal)} />
            {isIntra ? (
              <>
                <Row label="CGST" value={Number(cn.cgst_total)} muted />
                <Row label="SGST" value={Number(cn.sgst_total)} muted />
              </>
            ) : (
              <Row label="IGST" value={Number(cn.igst_total)} muted />
            )}
            <div className="mt-2 border-t border-border pt-2">
              <Row label="Total credited" value={Number(cn.total)} emphasize />
            </div>
          </CardContent>
        </Card>

        {cn.customers && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{cn.customers.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              {cn.customers.phone && <p>{cn.customers.phone}</p>}
              {cn.customers.gstin && <p className="text-xs">GSTIN: {cn.customers.gstin}</p>}
            </CardContent>
          </Card>
        )}

        {cn.reason && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reason</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm">{cn.reason}</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3 pt-2">
          {org && (
            <PdfDownloadButtons data={buildCreditNotePdfData({ cn, org, isIntra })} />
          )}
          {cn.invoice_id && (
            <div className="pt-1 text-center">
              <Link
                href={`/invoices/${cn.invoice_id}`}
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                View invoice
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function buildCreditNotePdfData({
  cn,
  org,
  isIntra,
}: {
  cn: CreditNoteRow;
  org: OrgForPdf;
  isIntra: boolean;
}): QuotePdfData {
  const subtotal = Number(cn.subtotal);
  const taxTotal = Number(cn.tax_total);
  const total = Number(cn.total);
  // Effective blended rate for the single summary line; the stored totals
  // (subtotal/tax/splits) are exact regardless.
  const effRate = subtotal > 0 ? round2((taxTotal / subtotal) * 100) : 0;
  const pos = cn.place_of_supply_state;

  return {
    doc_type: 'CREDIT NOTE',
    doc_number: cn.credit_note_number,
    reference: cn.invoices?.invoice_number ? `Against Invoice ${cn.invoices.invoice_number}` : null,
    issue_date: cn.issue_date,
    reverse_charge: false,
    watermark: null,
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
    customer: cn.customers
      ? {
          name: cn.customers.name,
          phone: cn.customers.phone,
          email: cn.customers.email,
          gstin: cn.customers.gstin,
          billing_address_line1: cn.customers.billing_address_line1,
          billing_address_line2: cn.customers.billing_address_line2,
          billing_city: cn.customers.billing_city,
          billing_state: cn.customers.billing_state,
          billing_pincode: cn.customers.billing_pincode,
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
      address_line1: null,
      address_line2: null,
      city: null,
      state: null,
      pincode: null,
    },
    project_label: null,
    lines: [
      {
        description: cn.reason || 'Credit against invoice',
        hsn_sac_code: null,
        unit: 'piece',
        quantity: 1,
        rate: subtotal,
        tax_rate_percent: effRate,
        amount: subtotal,
        tax_amount: taxTotal,
        line_total: total,
      },
    ],
    isIntraState: isIntra,
    totals: {
      subtotal,
      tax_total: taxTotal,
      cgst: Number(cn.cgst_total),
      sgst: Number(cn.sgst_total),
      igst: Number(cn.igst_total),
      round_off: Number(cn.round_off),
      total,
    },
    notes: cn.reason,
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
