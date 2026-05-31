'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PencilIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { formatINR, formatDateDMY } from '@/lib/format';
import {
  paymentKeys,
  fetchPayments,
  deriveInvoicePaymentState,
  type PaymentRow,
} from '@/lib/queries/payments';
import {
  settleMilestones,
  validatePlan,
  type MilestoneRow,
  type MilestoneDraft,
  type MilestoneStatus,
} from '@/lib/milestones';
import { setInvoiceSchedule } from '../actions';
import { PaymentPlanEditor, rowsFromMilestones } from './payment-plan-editor';

const STATUS_VARIANT: Record<MilestoneStatus, 'success' | 'warning' | 'neutral'> = {
  paid: 'success',
  partial: 'warning',
  due: 'neutral',
};
const STATUS_LABEL: Record<MilestoneStatus, string> = {
  paid: 'Paid',
  partial: 'Part-paid',
  due: 'Due',
};

// Reads the same payments cache key as the money hero, so the schedule settles
// live the instant a payment is optimistically recorded.
function usePaidAmount(
  invoiceId: string,
  invoiceTotal: number,
  initialPayments: PaymentRow[],
): number {
  const { data: payments = initialPayments } = useQuery({
    queryKey: paymentKeys.list(invoiceId),
    queryFn: () => fetchPayments(invoiceId),
    initialData: initialPayments,
  });
  return deriveInvoicePaymentState(payments, invoiceTotal).amount_paid;
}

export function PaymentSchedule({
  invoiceId,
  invoiceTotal,
  milestones,
  initialPayments,
}: {
  invoiceId: string;
  invoiceTotal: number;
  milestones: MilestoneRow[];
  initialPayments: PaymentRow[];
}) {
  const amountPaid = usePaidAmount(invoiceId, invoiceTotal, initialPayments);
  const settled = useMemo(
    () => settleMilestones(milestones, amountPaid),
    [milestones, amountPaid],
  );
  const hasPlan = milestones.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Payment plan</CardTitle>
          <EditPlanDialog
            invoiceId={invoiceId}
            invoiceTotal={invoiceTotal}
            milestones={milestones}
          />
        </div>
      </CardHeader>
      <CardContent className={hasPlan ? 'px-0' : undefined}>
        {hasPlan ? (
          <ul className="divide-y divide-border">
            {settled.map((m, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{m.label}</span>
                    <Badge variant={STATUS_VARIANT[m.status]}>{STATUS_LABEL[m.status]}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {m.percent != null && `${Number(m.percent)}% · `}
                    {m.due_date ? `due ${formatDateDMY(m.due_date)}` : 'no due date'}
                    {m.status === 'partial' && ` · ${formatINR(m.paid)} in`}
                  </p>
                </div>
                <span className="tabular shrink-0 text-sm font-semibold">
                  {formatINR(m.amount)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Billed as a single payment. Add a plan to collect an advance now and
            the balance later.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function EditPlanDialog({
  invoiceId,
  invoiceTotal,
  milestones,
}: {
  invoiceId: string;
  invoiceTotal: number;
  milestones: MilestoneRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<MilestoneDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasPlan = milestones.length >= 2;
  const initialRows = useMemo(
    () => (hasPlan ? rowsFromMilestones(milestones, invoiceTotal) : undefined),
    [hasPlan, milestones, invoiceTotal],
  );

  function save() {
    const err = validatePlan(plan, invoiceTotal);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await setInvoiceSchedule(invoiceId, plan);
      if (res.ok) {
        toast.success(plan.length > 0 ? 'Payment plan saved' : 'Payment plan cleared');
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? 'Could not save the plan.');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="sm" className="-mr-1 h-8 text-muted-foreground" />}
      >
        <PencilIcon className="size-3.5" />
        {hasPlan ? 'Edit' : 'Add plan'}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payment plan</DialogTitle>
          <DialogDescription>
            Split {formatINR(invoiceTotal)} into installments. Pick “Full payment”
            to clear the plan.
          </DialogDescription>
        </DialogHeader>
        <PaymentPlanEditor
          total={invoiceTotal}
          initialKind={hasPlan ? 'custom' : 'full'}
          initialRows={initialRows}
          onChange={setPlan}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
          <Button type="button" disabled={pending} onClick={save}>
            {pending ? 'Saving…' : 'Save plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
