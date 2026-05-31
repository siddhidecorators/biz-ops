'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatINR, round2 } from '@/lib/format';
import {
  resolveAmounts,
  advanceBalancePlan,
  type MilestoneDraft,
  type PlanKind,
} from '@/lib/milestones';

export type EditorRow = { label: string; percent: string; due_date: string };

const DEFAULT_CUSTOM: EditorRow[] = [
  { label: 'Advance', percent: '50', due_date: '' },
  { label: 'Balance on completion', percent: '50', due_date: '' },
];

const PRESETS: { kind: PlanKind; label: string; sub: string }[] = [
  { kind: 'full', label: 'Full payment', sub: 'One payment' },
  { kind: 'advance_balance', label: '50% advance', sub: '+ balance' },
  { kind: 'custom', label: 'Custom', sub: 'Your split' },
];

// A reusable payment-schedule builder. Reports the resolved installments (exact
// rupee amounts summing to `total`) up via onChange. Used by both the invoice
// create form and the "Edit plan" dialog on the detail page.
export function PaymentPlanEditor({
  total,
  initialKind = 'full',
  initialRows,
  onChange,
}: {
  total: number;
  initialKind?: PlanKind;
  initialRows?: EditorRow[];
  onChange: (drafts: MilestoneDraft[]) => void;
}) {
  const [kind, setKind] = useState<PlanKind>(initialKind);
  const [rows, setRows] = useState<EditorRow[]>(
    initialRows && initialRows.length >= 2 ? initialRows : DEFAULT_CUSTOM,
  );

  const lastIdx = rows.length - 1;
  const nonLastPct = rows
    .slice(0, lastIdx)
    .reduce((s, r) => s + (Number(r.percent) || 0), 0);
  const remainderPct = round2(100 - nonLastPct);

  const drafts = useMemo<MilestoneDraft[]>(() => {
    if (kind === 'full') return [];
    if (kind === 'advance_balance') return advanceBalancePlan(total, 50);
    const cleaned = rows.map((r) => ({
      label: r.label,
      percent: r.percent.trim() === '' ? 0 : Number(r.percent),
      due_date: r.due_date || null,
    }));
    return resolveAmounts(cleaned, total);
  }, [kind, rows, total]);

  // Report resolved drafts upward whenever they change (keyed on a stable
  // serialization so we don't loop when the parent re-renders).
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const serialized = JSON.stringify(drafts);
  useEffect(() => {
    onChangeRef.current(JSON.parse(serialized) as MilestoneDraft[]);
  }, [serialized]);

  function updateRow(i: number, patch: Partial<EditorRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((p) => {
          const active = kind === p.kind;
          return (
            <button
              key={p.kind}
              type="button"
              onClick={() => setKind(p.kind)}
              aria-pressed={active}
              className={cn(
                'rounded-xl border p-2.5 text-left transition-colors',
                active
                  ? 'border-primary bg-brand-tint'
                  : 'border-border bg-card hover:bg-muted/60',
              )}
            >
              <span className={cn('block text-sm font-semibold', active && 'text-primary')}>
                {p.label}
              </span>
              <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">
                {p.sub}
              </span>
            </button>
          );
        })}
      </div>

      {kind === 'custom' && (
        <div className="space-y-3">
          {rows.map((r, i) => {
            const isLast = i === lastIdx;
            return (
              <div key={i} className="rounded-xl border border-border bg-card/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Installment {i + 1}
                  </span>
                  {rows.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove installment ${i + 1}`}
                      onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Input
                    value={r.label}
                    onChange={(e) => updateRow(i, { label: e.target.value })}
                    placeholder="e.g. Advance"
                    className="h-10"
                    aria-label={`Installment ${i + 1} label`}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex h-10 items-center gap-1 rounded-lg border border-input px-2">
                      <Input
                        value={isLast ? String(remainderPct) : r.percent}
                        onChange={(e) => updateRow(i, { percent: e.target.value })}
                        inputMode="decimal"
                        placeholder="%"
                        disabled={isLast}
                        aria-label={`Installment ${i + 1} percent`}
                        className="h-8 border-0 px-1 shadow-none focus-visible:ring-0 disabled:opacity-100"
                      />
                      <span className="pr-1 text-sm text-muted-foreground">%</span>
                    </div>
                    <Input
                      type="date"
                      value={r.due_date}
                      onChange={(e) => updateRow(i, { due_date: e.target.value })}
                      className="h-10"
                      aria-label={`Installment ${i + 1} due date (optional)`}
                    />
                  </div>
                  <p className="text-right text-xs text-muted-foreground">
                    {formatINR(drafts[i]?.amount ?? 0)}
                    {isLast && ' · remaining balance'}
                  </p>
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() =>
                setRows((prev) => [...prev, { label: '', percent: '', due_date: '' }])
              }
            >
              <PlusIcon className="size-4" /> Add installment
            </Button>
            {remainderPct <= 0 && (
              <span className="text-xs text-warning-strong">
                Earlier installments exceed 100%
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Enter a % for each installment except the last, which takes the
            remaining balance. Due dates are optional.
          </p>
        </div>
      )}

      {kind !== 'full' && drafts.length > 0 && (
        <ul className="space-y-1.5 rounded-xl bg-muted/40 p-3 text-sm">
          {drafts.map((d, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate">
                {d.label || `Installment ${i + 1}`}
                {d.due_date && (
                  <span className="text-xs text-muted-foreground"> · by {d.due_date}</span>
                )}
              </span>
              <span className="tabular font-medium">{formatINR(d.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Convert stored milestone rows back into editor rows (for the Edit dialog).
export function rowsFromMilestones(
  milestones: ReadonlyArray<{
    label: string;
    percent: number | string | null;
    amount: number | string;
    due_date: string | null;
  }>,
  total: number,
): EditorRow[] {
  return milestones.map((m) => {
    const pct =
      m.percent != null && m.percent !== ''
        ? Number(m.percent)
        : total > 0
          ? round2((Number(m.amount) / total) * 100)
          : 0;
    return {
      label: m.label,
      percent: String(pct),
      due_date: m.due_date ?? '',
    };
  });
}
