'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  UsersIcon,
  PackageIcon,
  FileTextIcon,
  ReceiptIcon,
  SettingsIcon,
  BarChart3Icon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatINR } from '@/lib/format';
import {
  dashboardKeys,
  fetchDashboardCounts,
  type DashboardCounts,
} from '@/lib/queries/dashboard';
import { AppBar } from './app-bar';

export function HomeDashboard({
  orgName,
  firstName,
}: {
  orgName: string;
  firstName: string;
}) {
  const { data, isPending, isError } = useQuery({
    queryKey: dashboardKeys.counts(),
    queryFn: fetchDashboardCounts,
    // Counts change whenever the user creates/deletes anywhere — refresh on
    // window focus (default) and on every nav back to home (refetchOnMount).
    refetchOnMount: 'always',
  });

  return (
    <>
      <AppBar
        title={orgName}
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
            counts={data}
            countKey="customers"
            hintFor={(n) => (n === 0 ? 'Add your first' : 'View all')}
            loading={isPending}
            errored={isError}
          />
          <NavCard
            href="/products"
            Icon={PackageIcon}
            label="Products"
            counts={data}
            countKey="products"
            hintFor={(n) => {
              const unv = data?.unverified ?? 0;
              if (unv > 0) return `${unv} need review`;
              return n === 0 ? 'Add your first' : 'View all';
            }}
            highlight={(data?.unverified ?? 0) > 0}
            loading={isPending}
            errored={isError}
          />
          <NavCard
            href="/quotes"
            Icon={FileTextIcon}
            label="Quotes"
            counts={data}
            countKey="open_quotes"
            hintFor={(n) => (n === 0 ? 'Create your first' : 'Open quotes')}
            loading={isPending}
            errored={isError}
          />
          <NavCard
            href="/invoices"
            Icon={ReceiptIcon}
            label="Invoices"
            counts={data}
            countKey="unpaid_invoices"
            hintFor={(n) =>
              n === 0 ? 'All clear' : `${formatINR(data?.outstanding ?? 0)} due`
            }
            highlight={(data?.unpaid_invoices ?? 0) > 0}
            loading={isPending}
            errored={isError}
          />
        </div>

        <Link href="/reports" className="mt-3 block">
          <Card size="sm" className="transition-colors hover:bg-muted active:bg-muted">
            <CardContent className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-tint text-primary">
                <BarChart3Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Reports</p>
                <p className="text-xs text-muted-foreground">GST, sales &amp; who owes you</p>
              </div>
              <span aria-hidden className="text-muted-foreground">
                ›
              </span>
            </CardContent>
          </Card>
        </Link>
      </main>
    </>
  );
}

function NavCard({
  href,
  Icon,
  label,
  counts,
  countKey,
  hintFor,
  highlight,
  loading,
  errored,
}: {
  href: string;
  Icon: typeof UsersIcon;
  label: string;
  counts: DashboardCounts | undefined;
  countKey: keyof DashboardCounts;
  hintFor: (count: number) => string;
  highlight?: boolean;
  loading: boolean;
  errored: boolean;
}) {
  const count = counts?.[countKey] ?? 0;
  const hint = errored ? '—' : loading ? ' ' : hintFor(count);

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
            {loading && !counts ? (
              <div className="h-9 w-10 animate-pulse rounded bg-muted" />
            ) : (
              <p className="text-3xl leading-none tracking-tight">{count}</p>
            )}
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{hint || ' '}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
