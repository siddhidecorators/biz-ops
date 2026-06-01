'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { cn } from '@/lib/utils';
import { createCreditNote } from '../../credit-notes/actions';
import { invoiceKeys } from '@/lib/queries/invoices';
import { dashboardKeys } from '@/lib/queries/dashboard';

export function CreditNoteDialog({
  invoiceId,
  invoiceNumber,
  isCancelled,
}: {
  invoiceId: string;
  invoiceNumber: string;
  isCancelled: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'full' | 'partial'>(isCancelled ? 'partial' : 'full');
  const [reason, setReason] = useState('');
  const [taxable, setTaxable] = useState('');
  const [gst, setGst] = useState('18');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const res = await createCreditNote({
        invoiceId,
        mode,
        reason,
        taxable: mode === 'partial' ? Number(taxable) : undefined,
        gstPercent: mode === 'partial' ? Number(gst) : undefined,
      });
      if (res.ok && res.creditNoteId) {
        toast.success('Credit note created');
        queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
        queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(invoiceId) });
        queryClient.invalidateQueries({ queryKey: dashboardKeys.counts() });
        setOpen(false);
        router.push(`/credit-notes/${res.creditNoteId}`);
      } else {
        setError(res.error ?? 'Could not create the credit note.');
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="lg" className="h-11 w-full text-muted-foreground" />
        }
      >
        Cancel / credit note
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Credit note for {invoiceNumber}</DialogTitle>
          <DialogDescription>
            Reverse the whole invoice (cancels it) or credit part of it — returns,
            over-billing, a correction.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <ModeBtn
              active={mode === 'full'}
              onClick={() => setMode('full')}
              title="Full"
              sub="Cancel the invoice"
              disabled={isCancelled}
            />
            <ModeBtn
              active={mode === 'partial'}
              onClick={() => setMode('partial')}
              title="Partial"
              sub="Credit an amount"
            />
          </div>

          {isCancelled && (
            <p className="text-xs text-warning-strong">
              This invoice is already cancelled — only a partial credit note can be added.
            </p>
          )}

          {mode === 'partial' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cn-taxable">Taxable amount (₹)</Label>
                <Input
                  id="cn-taxable"
                  inputMode="decimal"
                  value={taxable}
                  onChange={(e) => setTaxable(e.target.value)}
                  placeholder="0"
                  className="h-11"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cn-gst">GST %</Label>
                <Input
                  id="cn-gst"
                  inputMode="decimal"
                  value={gst}
                  onChange={(e) => setGst(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="cn-reason">Reason</Label>
            <Textarea
              id="cn-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Order cancelled / items returned / over-billed"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
          <Button type="button" disabled={pending} onClick={submit}>
            {pending ? 'Saving…' : 'Save credit note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModeBtn({
  active,
  onClick,
  title,
  sub,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-xl border p-2.5 text-left transition-colors disabled:opacity-50',
        active ? 'border-primary bg-brand-tint' : 'border-border bg-card hover:bg-muted/60',
      )}
    >
      <span className={cn('block text-sm font-semibold', active && 'text-primary')}>{title}</span>
      <span className="mt-0.5 block text-[11px] text-muted-foreground">{sub}</span>
    </button>
  );
}
