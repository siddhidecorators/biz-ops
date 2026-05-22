'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import {
  SendIcon,
  CheckIcon,
  XIcon,
  PencilIcon,
  RotateCcwIcon,
  ArrowRightIcon,
  ReceiptIcon,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
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
import type { QuoteStatus } from '@/lib/enums';
import {
  setQuoteStatus,
  convertQuoteToInvoice,
  type StatusActionState,
} from '../actions';

const initialStatusState: StatusActionState = { ok: false };

export function QuoteActions({
  quoteId,
  status,
  invoiceId,
}: {
  quoteId: string;
  status: QuoteStatus;
  invoiceId: string | null;
}) {
  if (status === 'converted_to_invoice' && invoiceId) {
    return (
      <Link
        href={`/invoices/${invoiceId}`}
        className={cn(buttonVariants({ size: 'lg' }), 'h-12 w-full')}
      >
        <ReceiptIcon className="size-4" />
        View invoice
      </Link>
    );
  }

  return (
    <div className="space-y-3">
      {/* Status transitions */}
      <div className="grid grid-cols-2 gap-2">
        {status === 'draft' && (
          <StatusButton quoteId={quoteId} to="sent" label="Mark sent" Icon={SendIcon} primary />
        )}
        {status === 'sent' && (
          <>
            <StatusButton quoteId={quoteId} to="accepted" label="Mark accepted" Icon={CheckIcon} primary />
            <StatusButton quoteId={quoteId} to="declined" label="Mark declined" Icon={XIcon} variant="outline" />
          </>
        )}
        {status === 'accepted' && (
          <ConvertButton quoteId={quoteId} />
        )}
        {(status === 'declined' || status === 'expired') && (
          <StatusButton
            quoteId={quoteId}
            to={status === 'expired' ? 'sent' : 'draft'}
            label={status === 'expired' ? 'Re-send' : 'Reopen as draft'}
            Icon={RotateCcwIcon}
            variant="outline"
          />
        )}
        {(status === 'sent' || status === 'expired') && status !== 'sent' && null}
      </div>

      <Link
        href={`/quotes/${quoteId}/edit`}
        className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-11 w-full')}
      >
        <PencilIcon className="size-4" />
        Edit quote
      </Link>
    </div>
  );
}

function StatusButton({
  quoteId,
  to,
  label,
  Icon,
  primary,
  variant = 'default',
}: {
  quoteId: string;
  to: QuoteStatus;
  label: string;
  Icon: typeof CheckIcon;
  primary?: boolean;
  variant?: 'default' | 'outline';
}) {
  const action = setQuoteStatus.bind(null, quoteId, to);
  const [state, formAction, pending] = useActionState(
    async (_prev: StatusActionState | null) => action(),
    initialStatusState,
  );

  return (
    <form action={formAction} className={cn(primary && 'col-span-2')}>
      <Button
        type="submit"
        disabled={pending}
        variant={variant === 'outline' ? 'outline' : 'default'}
        size="lg"
        className="h-11 w-full"
      >
        <Icon className="size-4" />
        {pending ? 'Saving…' : label}
      </Button>
      {state.formError && (
        <p className="mt-1 text-xs text-destructive">{state.formError}</p>
      )}
    </form>
  );
}

function ConvertButton({ quoteId }: { quoteId: string }) {
  const action = convertQuoteToInvoice.bind(null, quoteId);
  const [state, formAction, pending] = useActionState(
    async (_prev: StatusActionState | null) => action(),
    initialStatusState,
  );

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button size="lg" className="col-span-2 h-11 w-full" />
        }
      >
        <ArrowRightIcon className="size-4" />
        Convert to invoice
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert quote to invoice?</DialogTitle>
          <DialogDescription>
            A new tax invoice is created with the next number in series. CGST/SGST or IGST split is
            applied automatically based on your state and the customer&apos;s place of supply.
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
            <Button type="submit" disabled={pending}>
              {pending ? 'Converting…' : 'Create invoice'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
