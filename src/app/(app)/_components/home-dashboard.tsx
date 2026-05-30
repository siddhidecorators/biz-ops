'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  PackageIcon,
  FileTextIcon,
  BarChart3Icon,
  UserPlusIcon,
  SettingsIcon,
  ChevronRightIcon,
  CircleCheckIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatINR } from '@/lib/format';
import { useCountUp } from '@/lib/use-count-up';
import { cn } from '@/lib/utils';
import {
  dashboardKeys,
  fetchDashboardCounts,
  type DashboardCounts,
} from '@/lib/queries/dashboard';
import { AppBar } from './app-bar';

const groupINR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

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
    refetchOnMount: 'always',
  });

  const loading = isPending && !data;

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

      <main className="mx-auto max-w-md space-y-6 px-5 py-6">
        <section className="animate-rise">
          <p className="text-overline">Welcome back</p>
          <h2 className="mt-1 text-3xl tracking-tight">Hi, {firstName}</h2>
        </section>

        <MoneyHero data={data} loading={loading} errored={isError} />

        <AttentionList data={data} loading={loading} />

        <section className="animate-rise space-y-2.5" style={{ animationDelay: '210ms' }}>
          <p className="text-overline mb-2 px-1">Manage</p>
          <NavRow
            href="/products"
            Icon={PackageIcon}
            tone="brand"
            title="Products"
            subtitle="Your catalogue & pricing"
          />
          <NavRow
            href="/leads"
            Icon={UserPlusIcon}
            tone="info"
            title="Leads"
            subtitle="Enquiries & follow-ups"
          />
          <NavRow
            href="/reports"
            Icon={BarChart3Icon}
            tone="success"
            title="Reports"
            subtitle="GST, sales & who owes you"
          />
        </section>
      </main>
    </>
  );
}

function MoneyHero({
  data,
  loading,
  errored,
}: {
  data: DashboardCounts | undefined;
  loading: boolean;
  errored: boolean;
}) {
  const outstanding = data?.outstanding ?? 0;
  const shown = useCountUp(outstanding);

  if (loading) {
    return (
      <div
        className="animate-rise h-32 rounded-2xl bg-muted"
        style={{ animationDelay: '70ms' }}
      />
    );
  }

  const hasDue = !errored && outstanding > 0.0099;

  if (!hasDue) {
    return (
      <Link href="/invoices" className="block animate-rise" style={{ animationDelay: '70ms' }}>
        <div className="press flex items-center gap-3 rounded-2xl border border-success/25 bg-success-tint px-5 py-5 shadow-sm">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-success/15 text-success-strong">
            <CircleCheckIcon className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-success-strong">
              {errored ? 'Open invoices' : "You're all paid up"}
            </p>
            <p className="text-xs text-success-strong/80">
              {errored ? 'Tap to view your invoices' : 'Nothing outstanding right now — nice.'}
            </p>
          </div>
          <ChevronRightIcon className="size-5 shrink-0 text-success-strong/60" />
        </div>
      </Link>
    );
  }

  let rupees = Math.floor(shown);
  let paise = Math.round((shown - rupees) * 100);
  if (paise === 100) {
    rupees += 1;
    paise = 0;
  }
  const unpaid = data?.unpaid_invoices ?? 0;

  return (
    <Link href="/invoices" className="block animate-rise" style={{ animationDelay: '70ms' }}>
      <div className="press relative overflow-hidden rounded-2xl bg-[linear-gradient(140deg,oklch(0.6_0.15_46),oklch(0.47_0.14_36))] px-5 py-5 text-primary-foreground shadow-md ring-1 ring-black/5">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-14 -right-12 size-44 rounded-full bg-white/10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-2 -bottom-20 size-32 rounded-full bg-white/[0.06]"
        />

        <p className="text-[11px] font-semibold tracking-[0.16em] text-primary-foreground/75 uppercase">
          You&apos;re owed
        </p>

        <div className="mt-1.5 flex items-baseline gap-1">
          <span className="text-2xl font-semibold text-primary-foreground/90">₹</span>
          <span className="tabular font-heading text-[2.8rem] leading-none tracking-tight">
            {groupINR.format(rupees)}
          </span>
          <span className="text-lg font-semibold text-primary-foreground/70">
            .{String(paise).padStart(2, '0')}
          </span>
        </div>

        <div className="mt-3.5 flex items-center justify-between">
          <p className="text-sm text-primary-foreground/85">
            Across {unpaid} unpaid invoice{unpaid === 1 ? '' : 's'}
          </p>
          <span className="inline-flex items-center gap-0.5 rounded-full bg-white/15 py-1 pr-2 pl-3 text-sm font-medium">
            View
            <ChevronRightIcon className="size-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}

type Tone = 'brand' | 'info' | 'success' | 'warning';

const CHIP: Record<Tone, string> = {
  brand: 'bg-brand-tint text-primary',
  info: 'bg-info-tint text-info-strong',
  success: 'bg-success-tint text-success-strong',
  warning: 'bg-warning-tint text-warning-strong',
};

function AttentionList({
  data,
  loading,
}: {
  data: DashboardCounts | undefined;
  loading: boolean;
}) {
  if (loading || !data) return null;

  const items: {
    href: string;
    Icon: typeof FileTextIcon;
    tone: Tone;
    title: string;
    sub: string;
  }[] = [];

  if (data.open_quotes > 0) {
    items.push({
      href: '/quotes',
      Icon: FileTextIcon,
      tone: 'brand',
      title: `${data.open_quotes} open quote${data.open_quotes === 1 ? '' : 's'}`,
      sub: 'Send, follow up, or convert to a bill',
    });
  }
  if (data.unverified > 0) {
    items.push({
      href: '/products',
      Icon: PackageIcon,
      tone: 'warning',
      title: `${data.unverified} product${data.unverified === 1 ? '' : 's'} to review`,
      sub: 'Confirm details before quoting',
    });
  }

  if (items.length === 0) return null;

  return (
    <section className="animate-rise" style={{ animationDelay: '140ms' }}>
      <p className="text-overline mb-2 px-1">Needs attention</p>
      <div className="space-y-2">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="block">
            <Card size="sm" className="press hover:bg-muted/50">
              <CardContent className="flex items-center gap-3">
                <span
                  className={cn(
                    'grid size-10 shrink-0 place-items-center rounded-full',
                    CHIP[it.tone],
                  )}
                >
                  <it.Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{it.title}</p>
                  <p className="text-xs text-muted-foreground">{it.sub}</p>
                </div>
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}

function NavRow({
  href,
  Icon,
  tone,
  title,
  subtitle,
}: {
  href: string;
  Icon: typeof PackageIcon;
  tone: Tone;
  title: string;
  subtitle: string;
}) {
  return (
    <Link href={href} className="block">
      <Card size="sm" className="press hover:bg-muted/50">
        <CardContent className="flex items-center gap-3">
          <span
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-full',
              CHIP[tone],
            )}
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
