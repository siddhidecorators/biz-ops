// Pure helpers + types for invoice payment schedules ("milestones").
//
// A milestone is one installment of an agreed payment plan, e.g. "Advance 50%".
// Milestones are a SOFT overlay on the invoice: they are settled greedily by
// the invoice's cumulative amount_paid, so they never touch GST, totals, or the
// payments ledger. An invoice with no milestones behaves as a single balance.

import { round2 } from '@/lib/format';

// Shape as stored in the DB (invoice_milestones).
export type MilestoneRow = {
  id: string;
  label: string;
  percent: number | string | null;
  amount: number | string;
  due_date: string | null;
  sort_order: number;
};

// What the editor produces and the create action / setInvoiceSchedule consume.
export type MilestoneDraft = {
  label: string;
  percent: number | null;
  amount: number;
  due_date: string | null;
};

export type MilestoneStatus = 'paid' | 'partial' | 'due';

export type SettledMilestone = {
  label: string;
  percent: number | null;
  amount: number;
  due_date: string | null;
  paid: number; // how much of this installment the cumulative payments cover
  outstanding: number; // amount - paid
  status: MilestoneStatus;
  isNext: boolean; // the first installment that still has money owed
};

export type PlanKind = 'full' | 'advance_balance' | 'custom';

/**
 * Greedily allocate cumulative `amountPaid` across milestones in order. The
 * first installment is filled before the next, mirroring how a business thinks:
 * "got the advance, balance is still pending". Returns per-installment paid /
 * outstanding / status and flags the single "next due" installment.
 */
export function settleMilestones(
  milestones: ReadonlyArray<Pick<MilestoneRow, 'label' | 'percent' | 'amount' | 'due_date'>>,
  amountPaid: number,
): SettledMilestone[] {
  let remaining = round2(Math.max(0, amountPaid));
  let nextAssigned = false;

  return milestones.map((m) => {
    const amount = round2(Number(m.amount));
    const paid = round2(Math.min(amount, remaining));
    remaining = round2(remaining - paid);
    const outstanding = round2(amount - paid);
    const status: MilestoneStatus =
      outstanding <= 0.0099 ? 'paid' : paid > 0.0099 ? 'partial' : 'due';
    const isNext = !nextAssigned && outstanding > 0.0099;
    if (isNext) nextAssigned = true;
    return {
      label: m.label,
      percent: m.percent == null ? null : Number(m.percent),
      amount,
      due_date: m.due_date,
      paid,
      outstanding,
      status,
      isNext,
    };
  });
}

/** The next installment with money still owed — for "next due" + payment prefill. */
export function nextDueMilestone(settled: SettledMilestone[]): SettledMilestone | null {
  return settled.find((m) => m.isNext) ?? null;
}

/**
 * Resolve a set of rows (percent- or amount-based) to exact rupee amounts that
 * sum to `total`. The LAST row absorbs the rounding remainder so the schedule
 * always ties out to the invoice total exactly.
 */
export function resolveAmounts(
  rows: ReadonlyArray<{
    label: string;
    percent: number | null;
    amount?: number | null;
    due_date: string | null;
  }>,
  total: number,
): MilestoneDraft[] {
  const t = round2(total);
  const n = rows.length;
  let allocated = 0;

  return rows.map((r, i) => {
    let amount: number;
    if (i === n - 1) {
      amount = round2(t - allocated); // remainder
    } else if (r.percent != null) {
      amount = round2((t * r.percent) / 100);
    } else {
      amount = round2(Number(r.amount ?? 0));
    }
    allocated = round2(allocated + amount);
    return {
      label: r.label.trim() || `Installment ${i + 1}`,
      percent: r.percent,
      amount,
      due_date: r.due_date,
    };
  });
}

/** Standard "X% advance, balance on completion" two-installment plan. */
export function advanceBalancePlan(total: number, advancePercent = 50): MilestoneDraft[] {
  const adv = Math.min(99, Math.max(1, advancePercent));
  return resolveAmounts(
    [
      { label: 'Advance', percent: adv, due_date: null },
      { label: 'Balance on completion', percent: round2(100 - adv), due_date: null },
    ],
    total,
  );
}

/**
 * Validate a finished plan. An empty plan is valid (means "no schedule, one
 * balance"). Otherwise: at least two installments, each positive, summing to
 * the invoice total (±₹1 tolerance — resolveAmounts already ties out, this
 * guards hand-entered amounts).
 */
export function validatePlan(drafts: MilestoneDraft[], total: number): string | null {
  if (drafts.length === 0) return null;
  if (drafts.length < 2) return 'A payment plan needs at least two installments.';
  for (const d of drafts) {
    if (!(d.amount > 0)) return 'Each installment must be more than ₹0.';
    if (!d.label.trim()) return 'Give every installment a label.';
  }
  const sum = round2(drafts.reduce((s, d) => s + d.amount, 0));
  if (Math.abs(sum - round2(total)) > 1) {
    return `Installments add up to ₹${sum.toFixed(2)}, but the invoice total is ₹${round2(
      total,
    ).toFixed(2)}.`;
  }
  return null;
}
