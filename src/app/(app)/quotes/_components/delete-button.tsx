'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { createClient } from '@/lib/supabase/browser';
import { quoteKeys, type QuoteListRow } from '@/lib/queries/quotes';

type Snapshot = ReadonlyArray<[readonly unknown[], QuoteListRow[] | undefined]>;

export function DeleteQuoteButton({
  quoteId,
  quoteNumber,
}: {
  quoteId: string;
  quoteNumber: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { mutate, isPending, error, reset } = useMutation<
    void,
    { code?: string; message?: string },
    void,
    { snapshots: Snapshot }
  >({
    mutationFn: async () => {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quoteId);
      if (deleteError) throw deleteError;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: quoteKeys.all });

      const snapshots = queryClient.getQueriesData<QuoteListRow[]>({
        queryKey: quoteKeys.lists(),
      });
      for (const [key, data] of snapshots) {
        if (!data) continue;
        queryClient.setQueryData(
          key,
          data.filter((row) => row.id !== quoteId),
        );
      }
      return { snapshots };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) {
        for (const [key, data] of ctx.snapshots) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error(err?.message ?? 'Could not delete quote.');
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: quoteKeys.detail(quoteId) });
      toast.success('Quote deleted');
      setOpen(false);
      router.push('/quotes');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
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

        {error && !isPending && (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error.message ?? 'Could not delete quote.'}
          </p>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() => mutate()}
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
