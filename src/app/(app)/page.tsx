import Link from 'next/link';
import { redirect } from 'next/navigation';
import { UsersIcon, PackageIcon, FileTextIcon, ReceiptIcon, SettingsIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { AppBar } from './_components/app-bar';

type ProfileRow = {
  full_name: string | null;
  org_id: string;
  role: string;
  orgs: { name: string; settings_complete: boolean } | null;
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, org_id, role, orgs(name, settings_complete)')
    .eq('id', user.id)
    .maybeSingle<ProfileRow>();

  if (!profile?.orgs?.settings_complete) redirect('/onboarding');

  // Use head: true to fetch counts only — no rows transferred
  const [customersRes, productsRes, unverifiedRes, openQuotesRes, unpaidInvoicesRes] =
    await Promise.all([
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase
        .from('product_templates')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),
      supabase
        .from('product_templates')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('verified', false),
      supabase
        .from('quotes')
        .select('id', { count: 'exact', head: true })
        .in('status', ['draft', 'sent', 'accepted']),
      supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .in('payment_status', ['unpaid', 'partial']),
    ]);

  const customerCount = customersRes.count ?? 0;
  const productCount = productsRes.count ?? 0;
  const unverifiedCount = unverifiedRes.count ?? 0;
  const openQuoteCount = openQuotesRes.count ?? 0;
  const unpaidInvoiceCount = unpaidInvoicesRes.count ?? 0;
  const firstName = profile.full_name?.split(' ')[0] ?? 'there';

  return (
    <>
      <AppBar
        title={profile.orgs.name}
        right={
          <Link
            href="/settings"
            aria-label="Settings"
            className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <SettingsIcon className="size-5" />
          </Link>
        }
      />

      <main className="mx-auto max-w-md px-6 py-6">
        <section className="mb-6">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Welcome back
          </p>
          <h2 className="mt-1 text-3xl tracking-tight">Hi, {firstName}</h2>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <NavCard
            href="/customers"
            Icon={UsersIcon}
            label="Customers"
            count={customerCount}
            hint={customerCount === 0 ? 'Add your first' : 'View all'}
          />
          <NavCard
            href="/products"
            Icon={PackageIcon}
            label="Products"
            count={productCount}
            hint={
              unverifiedCount > 0
                ? `${unverifiedCount} need review`
                : productCount === 0
                  ? 'Add your first'
                  : 'View all'
            }
            highlight={unverifiedCount > 0}
          />
          <NavCard
            href="/quotes"
            Icon={FileTextIcon}
            label="Quotes"
            count={openQuoteCount}
            hint={openQuoteCount === 0 ? 'Create your first' : 'Open quotes'}
          />
          <NavCard
            href="/invoices"
            Icon={ReceiptIcon}
            label="Invoices"
            count={unpaidInvoiceCount}
            hint={unpaidInvoiceCount === 0 ? 'All clear' : 'Pending payment'}
            highlight={unpaidInvoiceCount > 0}
          />
        </div>
      </main>
    </>
  );
}

function NavCard({
  href,
  Icon,
  label,
  count,
  hint,
  highlight,
  hideCount,
}: {
  href: string;
  Icon: typeof UsersIcon;
  label: string;
  count: number;
  hint: string;
  highlight?: boolean;
  hideCount?: boolean;
}) {
  return (
    <Link href={href} className="block">
      <Card size="sm" className="h-full transition-colors hover:bg-muted active:bg-muted">
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="grid size-8 place-items-center rounded-full bg-brand-tint text-primary">
              <Icon className="size-4" />
            </span>
            {highlight && (
              <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-300">
                Review
              </span>
            )}
          </div>
          <div className="space-y-0.5">
            {!hideCount && (
              <p className="text-3xl leading-none tracking-tight">{count}</p>
            )}
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
