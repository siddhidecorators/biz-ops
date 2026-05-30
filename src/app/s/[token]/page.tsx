import Link from 'next/link';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { formatINR, formatDateDMY } from '@/lib/format';
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from '@/lib/enums';

export const metadata = { title: 'Statement' };

type StatementInvoice = {
  invoice_number: string;
  issue_date: string;
  total: number | string;
  amount_paid: number | string;
  amount_due: number | string;
  payment_status: PaymentStatus;
  share_token: string;
};

type Statement = {
  org: {
    name: string;
    logo_url: string | null;
    brand_color: string | null;
    phone: string | null;
    email: string | null;
    upi_id: string | null;
    bank_account_name: string | null;
    bank_account_number: string | null;
    bank_ifsc: string | null;
    bank_name: string | null;
  };
  customer: { name: string };
  invoices: StatementInvoice[];
  total_due: number | string;
};

const PAY_STYLE: Record<PaymentStatus, string> = {
  unpaid: 'bg-rose-500/10 text-rose-700 ring-rose-500/30',
  partial: 'bg-amber-500/10 text-amber-700 ring-amber-500/30',
  paid: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30',
};

async function fetchStatement(token: string): Promise<Statement | null> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data, error } = await supabase.rpc('get_customer_statement', { p_token: token });
  if (error || !data) return null;
  return data as Statement;
}

export default async function PublicStatementPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await fetchStatement(token);

  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold">Statement not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This link may be incorrect. Please ask the sender for an updated link.
        </p>
      </main>
    );
  }

  const { org, customer, invoices } = data;
  const brand = org.brand_color || '#B8552A';
  const due = Number(data.total_due) || 0;
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
          <p className="text-xs text-muted-foreground">
            {[org.phone, org.email].filter(Boolean).join(' · ')}
          </p>
        </div>
      </header>

      <div className="my-5 h-1 rounded-full" style={{ backgroundColor: brand }} />

      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Account statement
      </p>
      <p className="text-lg font-semibold">{customer.name}</p>

      {due > 0 ? (
        <div
          className="mt-5 rounded-xl px-4 py-4 text-center text-white"
          style={{ backgroundColor: brand }}
        >
          <p className="text-xs uppercase tracking-wide opacity-90">Total outstanding</p>
          <p className="text-3xl font-bold">{formatINR(due)}</p>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-center">
          <p className="text-base font-semibold text-emerald-700">✓ No dues — all settled</p>
        </div>
      )}

      {/* Invoices */}
      <div className="mt-6 space-y-2.5">
        {invoices.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          invoices.map((inv, i) => (
            <Link
              key={i}
              href={`/i/${inv.share_token}`}
              className="block rounded-xl px-4 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {inv.invoice_number}
                </span>
                <span
                  className={
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ' +
                    PAY_STYLE[inv.payment_status]
                  }
                >
                  {PAYMENT_STATUS_LABELS[inv.payment_status]}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between text-xs text-muted-foreground">
                <span>{formatDateDMY(inv.issue_date)}</span>
                <span>
                  {formatINR(inv.total)}
                  {Number(inv.amount_due) > 0 && (
                    <span className="ml-2 font-semibold" style={{ color: brand }}>
                      {formatINR(inv.amount_due)} due
                    </span>
                  )}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* How to pay */}
      {due > 0 && (org.upi_id || hasBank) && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            How to pay
          </p>
          {org.upi_id && (
            <p className="mt-2 text-xs text-muted-foreground">
              UPI ID: <span className="font-medium text-foreground">{org.upi_id}</span>
            </p>
          )}
          {hasBank && (
            <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {org.bank_account_name && <p>A/c name: {org.bank_account_name}</p>}
              {org.bank_account_number && <p>A/c no: {org.bank_account_number}</p>}
              {org.bank_ifsc && <p>IFSC: {org.bank_ifsc}</p>}
              {org.bank_name && <p>Bank: {org.bank_name}</p>}
            </div>
          )}
        </div>
      )}

      <p className="mt-10 text-center text-[11px] text-muted-foreground">Powered by SmallBiz Ops</p>
    </main>
  );
}
