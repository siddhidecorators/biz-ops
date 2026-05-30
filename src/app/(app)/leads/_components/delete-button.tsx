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
import { deleteLead, type DeleteLeadState } from '../actions';

const initialState: DeleteLeadState = { ok: false };

export function DeleteLeadButton({
  leadId,
  leadName,
}: {
  leadId: string;
  leadName: string;
}) {
  const action = deleteLead.bind(null, leadId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            className="h-auto p-0 text-sm font-normal text-muted-foreground underline underline-offset-4 hover:bg-transparent hover:text-destructive"
          />
        }
      >
        Delete lead
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {leadName}?</DialogTitle>
          <DialogDescription>
            This removes the lead from your list. You can&apos;t undo this.
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
