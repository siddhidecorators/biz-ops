'use client';

import { useActionState, useState } from 'react';
import { IndianRupeeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { PAYMENT_MODES, PAYMENT_MODE_LABELS, type PaymentMode } from '@/lib/enums';
import { formatINR, isoDate } from '@/lib/format';
import { recordPayment, type PaymentFormState } from '../actions';

const initialState: PaymentFormState = { ok: false };

export function RecordPaymentDialog({
  invoiceId,
  amountDue,
  invoiceNumber,
}: {
  invoiceId: string;
  amountDue: number;
  invoiceNumber: string;
}) {
  const action = recordPayment.bind(null, invoiceId);
  const [state, formAction, pending] = useActionState(action, initialState);

  const [amount, setAmount] = useState<string>(amountDue.toFixed(2));
  const [mode, setMode] = useState<PaymentMode>('upi');
  const [date, setDate] = useState<string>(isoDate());

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button size="lg" className="h-12 w-full">
            <IndianRupeeIcon className="size-4" />
            Record payment
          </Button>
        }
      >
        Record payment
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {invoiceNumber} · Balance due {formatINR(amountDue)}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="amount">Amount received (₹)</Label>
            <Input
              id="amount"
              name="amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
              className="h-11"
            />
            {state.fieldErrors?.amount && (
              <p className="text-xs text-destructive">{state.fieldErrors.amount}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAmount(amountDue.toFixed(2))}
                className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent"
              >
                Full {formatINR(amountDue)}
              </button>
              <button
                type="button"
                onClick={() => setAmount((amountDue / 2).toFixed(2))}
                className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent"
              >
                Half {formatINR(amountDue / 2)}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="payment_date">Date</Label>
              <Input
                id="payment_date"
                name="payment_date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11"
              />
              {state.fieldErrors?.payment_date && (
                <p className="text-xs text-destructive">{state.fieldErrors.payment_date}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="mode">Mode</Label>
              <Select name="mode" value={mode} onValueChange={(v) => setMode(v as PaymentMode)}>
                <SelectTrigger id="mode" className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {PAYMENT_MODE_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state.fieldErrors?.mode && (
                <p className="text-xs text-destructive">{state.fieldErrors.mode}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="reference">
              Reference{' '}
              <span className="text-muted-foreground">
                ({modeHint(mode)})
              </span>
            </Label>
            <Input
              id="reference"
              name="reference"
              type="text"
              placeholder={modePlaceholder(mode)}
              className="h-11"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>

          {state.formError && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {state.formError}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function modeHint(mode: PaymentMode): string {
  switch (mode) {
    case 'upi':
      return 'UPI ref / txn ID';
    case 'bank_transfer':
      return 'UTR / txn ID';
    case 'cheque':
      return 'Cheque no.';
    case 'card':
      return 'Last 4 / approval code';
    default:
      return 'optional';
  }
}

function modePlaceholder(mode: PaymentMode): string {
  switch (mode) {
    case 'upi':
      return 'e.g. 432156789012';
    case 'bank_transfer':
      return 'e.g. SBIN23051200001234';
    case 'cheque':
      return 'e.g. 000456';
    default:
      return '';
  }
}
