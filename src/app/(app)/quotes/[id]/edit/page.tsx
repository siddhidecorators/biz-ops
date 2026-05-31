import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { AppBar } from '../../../_components/app-bar';
import {
  QuoteForm,
  type CustomerOption,
  type TemplateOption,
  type QuoteInitial,
} from '../../_components/quote-form';
import { updateQuote } from '../../actions';
import type { QuoteStatus, Unit } from '@/lib/enums';

export const metadata = { title: 'Edit quote' };

type QuoteRow = {
  id: string;
  status: QuoteStatus;
  customer_id: string;
  issue_date: string;
  valid_until: string;
  project_label: string | null;
  notes: string | null;
  install_address_line1: string | null;
  install_address_line2: string | null;
  install_city: string | null;
  install_state: string | null;
  install_pincode: string | null;
  quote_number: string;
};

type QuoteLineRow = {
  template_id: string | null;
  description: string;
  hsn_sac_code: string | null;
  unit: Unit;
  quantity: number | string;
  rate: number | string;
  tax_rate_percent: number | string;
  sort_order: number;
};

type QuoteMilestoneRow = {
  label: string;
  percent: number | string | null;
  amount: number | string;
  due_date: string | null;
  sort_order: number;
};

export default async function EditQuotePage({
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

  const [quoteRes, linesRes, milestonesRes, customersRes, templatesRes, profileRes] = await Promise.all([
    supabase
      .from('quotes')
      .select(
        `id, status, customer_id, issue_date, valid_until, project_label, notes,
         install_address_line1, install_address_line2, install_city, install_state, install_pincode, quote_number`,
      )
      .eq('id', id)
      .maybeSingle<QuoteRow>(),
    supabase
      .from('quote_lines')
      .select('template_id, description, hsn_sac_code, unit, quantity, rate, tax_rate_percent, sort_order')
      .eq('quote_id', id)
      .order('sort_order')
      .returns<QuoteLineRow[]>(),
    supabase
      .from('quote_milestones')
      .select('label, percent, amount, due_date, sort_order')
      .eq('quote_id', id)
      .order('sort_order')
      .returns<QuoteMilestoneRow[]>(),
    supabase
      .from('customers')
      .select('id, name, customer_type, phone, billing_state, billing_city')
      .order('name')
      .returns<CustomerOption[]>(),
    supabase
      .from('product_templates')
      .select('id, name, brand, craft, hsn_sac_code, unit, default_rate, tax_rate_percent')
      .eq('is_active', true)
      .order('name')
      .returns<TemplateOption[]>(),
    supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .maybeSingle<{ org_id: string }>(),
  ]);

  const quote = quoteRes.data;
  if (!quote) notFound();

  if (quote.status === 'converted_to_invoice') {
    return (
      <>
        <AppBar
          title={quote.quote_number}
          subtitle="Edit quote"
          back={{ href: `/quotes/${quote.id}` }}
        />
        <main className="mx-auto max-w-md px-6 py-5">
          <Card>
            <CardContent className="space-y-3 py-6 text-center text-sm">
              <p className="font-medium">This quote was converted to an invoice.</p>
              <p className="text-muted-foreground">
                Edit the invoice instead — the quote is now a record of what was agreed.
              </p>
              <Link
                href={`/quotes/${quote.id}`}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium"
              >
                Back to quote
              </Link>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  const orgRes = profileRes.data
    ? await supabase
        .from('orgs')
        .select('state, quote_validity_days')
        .eq('id', profileRes.data.org_id)
        .maybeSingle<{ state: string | null; quote_validity_days: number }>()
    : { data: null };

  const initial: QuoteInitial = {
    customer_id: quote.customer_id,
    issue_date: quote.issue_date,
    valid_until: quote.valid_until,
    project_label: quote.project_label ?? '',
    notes: quote.notes ?? '',
    install_address_line1: quote.install_address_line1 ?? '',
    install_address_line2: quote.install_address_line2 ?? '',
    install_city: quote.install_city ?? '',
    install_state: quote.install_state ?? '',
    install_pincode: quote.install_pincode ?? '',
    lines: (linesRes.data ?? []).map((l) => ({
      template_id: l.template_id,
      description: l.description,
      hsn_sac_code: l.hsn_sac_code ?? '',
      unit: l.unit,
      quantity: String(l.quantity),
      rate: String(l.rate),
      tax_rate_percent: String(l.tax_rate_percent),
    })),
    milestones: (milestonesRes.data ?? []).map((m) => ({
      label: m.label,
      percent: m.percent == null ? null : Number(m.percent),
      amount: Number(m.amount),
      due_date: m.due_date,
    })),
  };

  const action = updateQuote.bind(null, quote.id);

  return (
    <>
      <AppBar
        title={quote.quote_number}
        subtitle="Edit quote"
        back={{ href: `/quotes/${quote.id}` }}
      />
      <main className="mx-auto max-w-2xl px-6 py-5">
        <QuoteForm
          customers={customersRes.data ?? []}
          templates={templatesRes.data ?? []}
          orgState={orgRes.data?.state ?? null}
          defaultValidityDays={orgRes.data?.quote_validity_days ?? 30}
          action={action}
          initial={initial}
          submitLabel="Save changes"
        />
      </main>
    </>
  );
}
