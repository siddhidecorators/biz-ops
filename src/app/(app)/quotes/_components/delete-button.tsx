'use client';

import { useActionState } from 'react';
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
import { deleteQuote, type DeleteQuoteState } from '../actions';

const initialState: DeleteQuoteState = { ok: false };

export function DeleteQuoteButton({
  quoteId,
  quoteNumber,
}: {
  quoteId: string;
  quoteNumber: string;
}) {
  const action = deleteQuote.bind(null, quoteId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="destructive" size="lg" className="h-12 w-full" />}>
        Delete quote
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {quoteNumber}?</DialogTitle>
          <DialogDescription>
            This removes the quote and all its line items. You can&apos;t undo this.
          </DialogDescription>
        </DialogHeader>

        {state.formError && (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {state.formError}
          </p>
        )}

        <form action={formAction}>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
