'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IndianRupeeIcon } from 'lucide-react';
import { toast } from 'sonner';
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
import {
  PAYMENT_MODES,
  PAYMENT_MODE_LABELS,
  type PaymentMode,
} from '@/lib/enums';
import { formatINR, isoDate } from '@/lib/format';
import { createClient } from '@/lib/supabase/browser';
import {
  paymentKeys,
  fetchPayments,
  deriveInvoicePaymentState,
  type PaymentRow,
} from '@/lib/queries/payments';
import { invoiceKeys } from '@/lib/queries/invoices';
import { dashboardKeys } from '@/lib/queries/dashboard';

type FieldErrors = Partial<{
  amount: string;
  payment_date: string;
  mode: string;
}>;

export function RecordPaymentDialog({
  invoiceId,
  invoiceTotal,
  invoiceNumber,
}: {
  invoiceId: string;
  invoiceTotal: number;
  invoiceNumber: string;
}) {
  const queryClient = useQueryClient();

  // Read current payments from the cache to compute live amount due. The
  // query is shared with the rest of the detail page so we get the same row
  // mutations see, including the optimistic prepend below.
  const { data: payments = [] } = useQuery({
    queryKey: paymentKeys.list(invoiceId),
    queryFn: () => fetchPayments(invoiceId),
    // No initialData here — we expect the pill/ledger to have seeded it. If
    // they haven't, the query fires and we just show a stale amount briefly.
  });
  const { amount_due } = deriveInvoicePaymentState(payments, invoiceTotal);
  const fullyPaid = amount_due <= 0.0099;

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>(amount_due.toFixed(2));
  const [mode, setMode] = useState<PaymentMode>('upi');
  const [date, setDate] = useState<string>(isoDate());
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Reset the form to a fresh balance-due amount each time the dialog opens.
  useEffect(() => {
    if (open) {
      const fresh = queryClient.getQueryData<PaymentRow[]>(
        paymentKeys.list(invoiceId),
      );
      const due = deriveInvoicePaymentState(fresh ?? [], invoiceTotal).amount_due;
      setAmount(due.toFixed(2));
      setMode('upi');
      setDate(isoDate());
      setReference('');
      setNotes('');
      setFieldErrors({});
    }
  }, [open, invoiceId, invoiceTotal, queryClient]);

  const { mutate, isPending } = useMutation<
    PaymentRow,
    { code?: string; message?: string },
    { amount: number; payment_date: string; mode: PaymentMode; reference: string; notes: string },
    { previous: PaymentRow[] | undefined; optimisticId: string }
  >({
    mutationFn: async (input) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('payments')
        .insert({
          invoice_id: invoiceId,
          amount: input.amount,
          payment_date: input.payment_date,
          mode: input.mode,
          reference: input.reference || null,
          notes: input.notes || null,
        })
        .select('id, amount, payment_date, mode, reference, notes')
        .single<PaymentRow>();
      if (error) throw error;
      if (!data) throw new Error('Payment insert returned no row');
      return data;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: paymentKeys.list(invoiceId) });
      const previous = queryClient.getQueryData<PaymentRow[]>(
        paymentKeys.list(invoiceId),
      );
      const optimisticId = `optimistic-${Date.now()}`;
      const optimistic: PaymentRow = {
        id: optimisticId,
        amount: input.amount,
        payment_date: input.payment_date,
        mode: input.mode,
        reference: input.reference || null,
        notes: input.notes || null,
      };
      queryClient.setQueryData<PaymentRow[]>(
        paymentKeys.list(invoiceId),
        (curr) => [optimistic, ...(curr ?? [])],
      );
      return { previous, optimisticId };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) {
        queryClient.setQueryData(paymentKeys.list(invoiceId), ctx.previous);
      }
      toast.error(err?.message ?? 'Could not record payment.');
    },
    onSuccess: (real, _vars, ctx) => {
      // Swap our temp row for the real one (carries the server id + timestamps)
      if (ctx) {
        queryClient.setQueryData<PaymentRow[]>(
          paymentKeys.list(invoiceId),
          (curr) =>
            (curr ?? []).map((r) => (r.id === ctx.optimisticId ? real : r)),
        );
      }
      toast.success('Payment recorded');
      setOpen(false);
    },
    onSettled: () => {
      // Cross-surface invalidation — list cards and dashboard counts see new
      // status; payments cache will be re-fetched too in case the DB trigger
      // changed anything we didn't predict.
      queryClient.invalidateQueries({ queryKey: paymentKeys.list(invoiceId) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(invoiceId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.counts() });
    },
  });

  function validateAndSubmit() {
    const errs: FieldErrors = {};
    const trimmed = amount.trim();
    if (!trimmed || !/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      errs.amount = 'Enter a valid amount';
    } else {
      const n = Number(trimmed);
      if (n <= 0) {
        errs.amount = 'Amount must be more than zero';
      } else if (n > amount_due + 0.01) {
        errs.amount = `Amount can't exceed balance due (${amount_due.toFixed(2)}).`;
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errs.payment_date = 'Pick a valid date';
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    mutate({
      amount: Number(trimmed),
      payment_date: date,
      mode,
      reference,
      notes,
    });
  }

  // Hide the trigger button entirely once the balance is settled. The
  // InvoicePaidInFullBanner sibling renders the celebratory state.
  if (fullyPaid) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            {invoiceNumber} · Balance due {formatINR(amount_due)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
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
            {fieldErrors.amount && (
              <p className="text-xs text-destructive">{fieldErrors.amount}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAmount(amount_due.toFixed(2))}
                className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent"
              >
                Full {formatINR(amount_due)}
              </button>
              <button
                type="button"
                onClick={() => setAmount((amount_due / 2).toFixed(2))}
                className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent"
              >
                Half {formatINR(amount_due / 2)}
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
              {fieldErrors.payment_date && (
                <p className="text-xs text-destructive">{fieldErrors.payment_date}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="mode">Mode</Label>
              <Select
                name="mode"
                value={mode}
                onValueChange={(v) => setMode(v as PaymentMode)}
              >
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
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="reference">
              Reference{' '}
              <span className="text-muted-foreground">({modeHint(mode)})</span>
            </Label>
            <Input
              id="reference"
              name="reference"
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={modePlaceholder(mode)}
              className="h-11"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button type="button" disabled={isPending} onClick={validateAndSubmit}>
              {isPending ? 'Saving…' : 'Save payment'}
            </Button>
          </DialogFooter>
        </div>
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
