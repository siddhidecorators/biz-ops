'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PAYMENT_MODE_LABELS } from '@/lib/enums';
import { formatINR, formatDateDMY } from '@/lib/format';
import { createClient } from '@/lib/supabase/browser';
import {
  paymentKeys,
  fetchPayments,
  type PaymentRow,
} from '@/lib/queries/payments';
import { invoiceKeys } from '@/lib/queries/invoices';
import { dashboardKeys } from '@/lib/queries/dashboard';

export function PaymentsLedger({
  invoiceId,
  initialPayments,
}: {
  invoiceId: string;
  initialPayments: PaymentRow[];
}) {
  const { data: payments = initialPayments } = useQuery({
    queryKey: paymentKeys.list(invoiceId),
    queryFn: () => fetchPayments(invoiceId),
    initialData: initialPayments,
  });

  if (payments.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payments ledger</CardTitle>
        <p className="text-xs text-muted-foreground">
          {payments.length} {payments.length === 1 ? 'payment' : 'payments'} recorded
        </p>
      </CardHeader>
      <CardContent className="px-0">
        <ul className="divide-y divide-border">
          {payments.map((p) => (
            <PaymentRowItem key={p.id} payment={p} invoiceId={invoiceId} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function PaymentRowItem({
  payment: p,
  invoiceId,
}: {
  payment: PaymentRow;
  invoiceId: string;
}) {
  const isOptimistic = p.id.startsWith('optimistic-');
  return (
    <li
      className={
        'flex items-start gap-3 px-4 py-3 text-sm ' +
        (isOptimistic ? 'opacity-70' : '')
      }
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-base font-medium">{formatINR(p.amount)}</span>
          <span className="text-xs text-muted-foreground">
            {formatDateDMY(p.payment_date)}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {PAYMENT_MODE_LABELS[p.mode]}
          {p.reference && ` · ${p.reference}`}
        </p>
        {p.notes && <p className="mt-1 text-xs">{p.notes}</p>}
      </div>
      {!isOptimistic && (
        <DeletePaymentButton
          paymentId={p.id}
          invoiceId={invoiceId}
          amount={Number(p.amount)}
        />
      )}
    </li>
  );
}

function DeletePaymentButton({
  paymentId,
  invoiceId,
  amount,
}: {
  paymentId: string;
  invoiceId: string;
  amount: number;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useMutation<
    void,
    { code?: string; message?: string },
    void,
    { previous: PaymentRow[] | undefined }
  >({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentId);
      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: paymentKeys.list(invoiceId),
      });
      const previous = queryClient.getQueryData<PaymentRow[]>(
        paymentKeys.list(invoiceId),
      );
      queryClient.setQueryData<PaymentRow[]>(
        paymentKeys.list(invoiceId),
        (curr) => (curr ?? []).filter((r) => r.id !== paymentId),
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) {
        queryClient.setQueryData(paymentKeys.list(invoiceId), ctx.previous);
      }
      toast.error(err?.message ?? 'Could not delete payment.');
    },
    onSuccess: () => {
      toast.success('Payment removed');
      setOpen(false);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: paymentKeys.list(invoiceId),
      });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(invoiceId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.counts() });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete payment"
            className="shrink-0 text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2Icon className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this payment?</DialogTitle>
          <DialogDescription>
            Removes {formatINR(amount)} from the ledger. The invoice&apos;s paid
            amount and balance will update automatically.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() => mutate()}
          >
            {isPending ? 'Removing…' : 'Delete payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
