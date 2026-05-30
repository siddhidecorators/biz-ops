import { createClient } from '@/lib/supabase/browser';

export type ReportInvoice = {
  invoice_number: string;
  issue_date: string;
  payment_status: 'unpaid' | 'partial' | 'paid';
  subtotal: number | string;
  cgst_total: number | string;
  sgst_total: number | string;
  igst_total: number | string;
  total: number | string;
  amount_paid: number | string;
  amount_due: number | string;
  place_of_supply_state: string | null;
  customers: { name: string; gstin: string | null } | null;
};

export type OpenInvoice = {
  invoice_number: string;
  issue_date: string;
  amount_due: number | string;
  customers: { name: string } | null;
};

export const reportKeys = {
  all: ['reports'] as const,
  period: (from: string, to: string) => [...reportKeys.all, 'period', from, to] as const,
  openInvoices: () => [...reportKeys.all, 'open'] as const,
};

export async function fetchInvoicesForPeriod(
  from: string,
  to: string,
): Promise<ReportInvoice[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select(
      'invoice_number, issue_date, payment_status, subtotal, cgst_total, sgst_total, igst_total, total, amount_paid, amount_due, place_of_supply_state, customers(name, gstin)',
    )
    .gte('issue_date', from)
    .lte('issue_date', to)
    .order('issue_date', { ascending: true })
    .returns<ReportInvoice[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchOpenInvoices(): Promise<OpenInvoice[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select('invoice_number, issue_date, amount_due, customers(name)')
    .in('payment_status', ['unpaid', 'partial'])
    .order('issue_date', { ascending: true })
    .returns<OpenInvoice[]>();
  if (error) throw error;
  return data ?? [];
}

const n = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

export function salesSummary(invoices: ReportInvoice[]) {
  return invoices.reduce(
    (acc, i) => {
      acc.count += 1;
      acc.invoiced += n(i.total);
      acc.collected += n(i.amount_paid);
      acc.outstanding += n(i.amount_due);
      return acc;
    },
    { count: 0, invoiced: 0, collected: 0, outstanding: 0 },
  );
}

export function gstSummary(invoices: ReportInvoice[]) {
  return invoices.reduce(
    (acc, i) => {
      acc.taxable += n(i.subtotal);
      acc.cgst += n(i.cgst_total);
      acc.sgst += n(i.sgst_total);
      acc.igst += n(i.igst_total);
      acc.total += n(i.total);
      return acc;
    },
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 },
  );
}

export type AgingBuckets = {
  current: number; // 0–30 days
  d30: number; // 31–60
  d60: number; // 61–90
  d90: number; // 90+
  total: number;
};

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + 'T00:00:00Z').getTime();
  const b = new Date(toIso + 'T00:00:00Z').getTime();
  return Math.floor((b - a) / 86_400_000);
}

export function agingFrom(open: OpenInvoice[], todayIso: string): AgingBuckets {
  const buckets: AgingBuckets = { current: 0, d30: 0, d60: 0, d90: 0, total: 0 };
  for (const inv of open) {
    const due = n(inv.amount_due);
    if (due <= 0) continue;
    const age = daysBetween(inv.issue_date, todayIso);
    if (age <= 30) buckets.current += due;
    else if (age <= 60) buckets.d30 += due;
    else if (age <= 90) buckets.d60 += due;
    else buckets.d90 += due;
    buckets.total += due;
  }
  return buckets;
}

// GSTR-1-friendly per-invoice CSV (sales register). Plain numbers, no ₹.
export function invoicesToCsv(invoices: ReportInvoice[]): string {
  const header = [
    'Invoice No',
    'Date',
    'Customer',
    'GSTIN',
    'Place of Supply',
    'Taxable Value',
    'CGST',
    'SGST',
    'IGST',
    'Invoice Total',
  ];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = invoices.map((i) =>
    [
      i.invoice_number,
      i.issue_date,
      i.customers?.name ?? '',
      i.customers?.gstin ?? '',
      i.place_of_supply_state ?? '',
      n(i.subtotal).toFixed(2),
      n(i.cgst_total).toFixed(2),
      n(i.sgst_total).toFixed(2),
      n(i.igst_total).toFixed(2),
      n(i.total).toFixed(2),
    ]
      .map((c) => esc(String(c)))
      .join(','),
  );
  return [header.map(esc).join(','), ...rows].join('\r\n');
}
