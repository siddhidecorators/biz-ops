'use client';

import { useActionState } from 'react';
import { Trash2Icon } from 'lucide-react';
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
import { PAYMENT_MODE_LABELS, type PaymentMode } from '@/lib/enums';
import { formatINR, formatDateDMY } from '@/lib/format';
import { deletePayment, type DeletePaymentState } from '../actions';

const initialState: DeletePaymentState = { ok: false };

export type PaymentRow = {
  id: string;
  amount: number | string;
  payment_date: string;
  mode: PaymentMode;
  reference: string | null;
  notes: string | null;
};

export function PaymentsLedger({
  invoiceId,
  payments,
}: {
  invoiceId: string;
  payments: PaymentRow[];
}) {
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
  return (
    <li className="flex items-start gap-3 px-4 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-base font-medium">{formatINR(p.amount)}</span>
          <span className="text-xs text-muted-foreground">{formatDateDMY(p.payment_date)}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {PAYMENT_MODE_LABELS[p.mode]}
          {p.reference && ` · ${p.reference}`}
        </p>
        {p.notes && <p className="mt-1 text-xs">{p.notes}</p>}
      </div>
      <DeletePaymentButton paymentId={p.id} invoiceId={invoiceId} amount={Number(p.amount)} />
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
  const action = deletePayment.bind(null, paymentId, invoiceId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Dialog>
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
            Removes {formatINR(amount)} from the ledger. The invoice&apos;s paid amount and
            balance will update automatically.
          </DialogDescription>
        </DialogHeader>

        {state.formError && (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {state.formError}
          </p>
        )}

        <form action={formAction}>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Removing…' : 'Delete payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
