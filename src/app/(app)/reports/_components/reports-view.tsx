'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DownloadIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatINR } from '@/lib/format';
import {
  reportKeys,
  fetchInvoicesForPeriod,
  fetchOpenInvoices,
  salesSummary,
  gstSummary,
  agingFrom,
  invoicesToCsv,
} from '@/lib/queries/reports';
import { AppBar } from '../../_components/app-bar';

type Period = 'month' | 'fy' | 'all';

export function ReportsView({
  today,
  fyStart,
  monthStart,
  fyLabel,
}: {
  today: string;
  fyStart: string;
  monthStart: string;
  fyLabel: string;
}) {
  const [period, setPeriod] = useState<Period>('fy');

  const range: { from: string; to: string } =
    period === 'month'
      ? { from: monthStart, to: today }
      : period === 'fy'
        ? { from: fyStart, to: today }
        : { from: '2000-04-01', to: today };

  const { data: invoices, isPending } = useQuery({
    queryKey: reportKeys.period(range.from, range.to),
    queryFn: () => fetchInvoicesForPeriod(range.from, range.to),
    placeholderData: (prev) => prev,
  });

  const { data: openInvoices } = useQuery({
    queryKey: reportKeys.openInvoices(),
    queryFn: fetchOpenInvoices,
  });

  const list = invoices ?? [];
  const sales = salesSummary(list);
  const gst = gstSummary(list);
  const aging = agingFrom(openInvoices ?? [], today);

  function downloadCsv() {
    const csv = invoicesToCsv(list);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-${range.from}-to-${range.to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const periodLabel =
    period === 'month' ? 'This month' : period === 'fy' ? `FY ${fyLabel}` : 'All time';

  return (
    <>
      <AppBar title="Reports" subtitle={periodLabel} back={{ href: '/' }} />
      <main className="mx-auto max-w-md space-y-4 px-6 py-5">
        {/* Period selector */}
        <div className="flex items-center gap-2 text-xs">
          {(['month', 'fy', 'all'] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                'rounded-full px-3 py-1 ring-1 transition-colors',
                period === p
                  ? 'bg-primary text-primary-foreground ring-primary'
                  : 'bg-card text-muted-foreground ring-border hover:bg-muted',
              )}
            >
              {p === 'month' ? 'This month' : p === 'fy' ? 'This FY' : 'All time'}
            </button>
          ))}
        </div>

        {/* Sales */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales</CardTitle>
            <p className="text-xs text-muted-foreground">
              {isPending && !invoices ? 'Loading…' : `${sales.count} invoice${sales.count === 1 ? '' : 's'}`}
            </p>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Invoiced" value={sales.invoiced} />
            <Row label="Collected" value={sales.collected} muted />
            <div className="mt-1 flex items-baseline justify-between border-t border-border pt-2 text-base font-semibold">
              <span>Outstanding</span>
              <span className="text-primary">{formatINR(sales.outstanding)}</span>
            </div>
          </CardContent>
        </Card>

        {/* GST summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">GST collected</CardTitle>
            <p className="text-xs text-muted-foreground">For your GSTR-1 / accountant</p>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Taxable value" value={gst.taxable} muted />
            <Row label="CGST" value={gst.cgst} muted />
            <Row label="SGST" value={gst.sgst} muted />
            <Row label="IGST" value={gst.igst} muted />
            <div className="mt-1 flex items-baseline justify-between border-t border-border pt-2 font-semibold">
              <span>Total GST</span>
              <span>{formatINR(gst.cgst + gst.sgst + gst.igst)}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="mt-3 h-11 w-full"
              onClick={downloadCsv}
              disabled={list.length === 0}
            >
              <DownloadIcon className="size-4" />
              Download CSV ({list.length})
            </Button>
          </CardContent>
        </Card>

        {/* Receivables aging */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Who owes you</CardTitle>
            <p className="text-xs text-muted-foreground">
              {aging.total > 0 ? `${formatINR(aging.total)} outstanding` : 'All clear 🎉'}
            </p>
          </CardHeader>
          {aging.total > 0 && (
            <CardContent className="space-y-1.5 text-sm">
              <AgingRow label="0–30 days" value={aging.current} />
              <AgingRow label="31–60 days" value={aging.d30} warn />
              <AgingRow label="61–90 days" value={aging.d60} warn />
              <AgingRow label="90+ days" value={aging.d90} danger />
            </CardContent>
          )}
        </Card>
      </main>
    </>
  );
}

function Row({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between', muted && 'text-muted-foreground')}>
      <span>{label}</span>
      <span>{formatINR(value)}</span>
    </div>
  );
}

function AgingRow({
  label,
  value,
  warn,
  danger,
}: {
  label: string;
  value: number;
  warn?: boolean;
  danger?: boolean;
}) {
  if (value <= 0) {
    return (
      <div className="flex items-baseline justify-between text-muted-foreground/60">
        <span>{label}</span>
        <span>—</span>
      </div>
    );
  }
  return (
    <div className="flex items-baseline justify-between">
      <span className={cn(danger && 'text-destructive', warn && 'text-amber-700')}>{label}</span>
      <span className={cn('font-medium', danger && 'text-destructive')}>{formatINR(value)}</span>
    </div>
  );
}
