import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { isoDate } from '@/lib/format';
import { AppBar } from '../../_components/app-bar';
import { InvoiceForm } from '../_components/invoice-form';
import type {
  CustomerOption,
  TemplateOption,
} from '../../quotes/_components/quote-form';

export const metadata = { title: 'New invoice' };

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { customer: defaultCustomerId } = await searchParams;

  const [{ data: profile }, customersRes, templatesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .maybeSingle<{ org_id: string }>(),
    supabase
      .from('customers')
      .select('id, name, customer_type, phone, billing_state, billing_city')
      .order('name')
      .returns<CustomerOption[]>(),
    supabase
      .from('product_templates')
      .select(
        'id, name, brand, craft, hsn_sac_code, unit, default_rate, tax_rate_percent',
      )
      .eq('is_active', true)
      .order('name')
      .returns<TemplateOption[]>(),
  ]);

  if (!profile) redirect('/sign-in');

  const { data: org } = await supabase
    .from('orgs')
    .select('state')
    .eq('id', profile.org_id)
    .maybeSingle<{ state: string | null }>();

  const customers = customersRes.data ?? [];
  const today = isoDate();

  if (customers.length === 0) {
    return (
      <>
        <AppBar title="New invoice" back={{ href: '/invoices' }} />
        <main className="mx-auto max-w-md px-5 py-5">
          <Card>
            <CardContent className="space-y-4 py-6 text-center">
              <p className="text-base font-medium">Add a customer first</p>
              <p className="text-sm text-muted-foreground">
                Invoices need a customer for billing details and the GST treatment.
              </p>
              <Link
                href="/customers/new"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
              >
                Add a customer
              </Link>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <AppBar title="New invoice" back={{ href: '/invoices' }} />
      <main className="mx-auto max-w-2xl px-5 py-5">
        <InvoiceForm
          customers={customers}
          templates={templatesRes.data ?? []}
          orgState={org?.state ?? null}
          today={today}
          defaultCustomerId={defaultCustomerId ?? null}
        />
      </main>
    </>
  );
}
