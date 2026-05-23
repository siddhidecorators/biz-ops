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
import { customerKeys, type CustomerListRow } from '@/lib/queries/customers';

type Snapshot = ReadonlyArray<[readonly unknown[], CustomerListRow[] | undefined]>;

export function DeleteCustomerButton({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
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
        .from('customers')
        .delete()
        .eq('id', customerId);
      if (deleteError) throw deleteError;
    },
    onMutate: async () => {
      // Pause inflight refetches so they don't clobber our optimistic state.
      await queryClient.cancelQueries({ queryKey: customerKeys.all });

      // Remove the row from every cached list variant (different search terms
      // each have their own cache entry).
      const snapshots = queryClient.getQueriesData<CustomerListRow[]>({
        queryKey: customerKeys.lists(),
      });
      for (const [key, data] of snapshots) {
        if (!data) continue;
        queryClient.setQueryData(
          key,
          data.filter((row) => row.id !== customerId),
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
      const friendly =
        err?.code === '23503'
          ? "This customer has quotes or invoices and can't be deleted."
          : err?.message ?? 'Could not delete customer.';
      toast.error(friendly);
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: customerKeys.detail(customerId) });
      toast.success('Customer deleted');
      setOpen(false);
      router.push('/customers');
    },
    onSettled: () => {
      // Re-sync with the server in the background so reality and cache match.
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
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
      <DialogTrigger
        render={<Button variant="destructive" size="lg" className="h-12 w-full" />}
      >
        Delete customer
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {customerName}?</DialogTitle>
          <DialogDescription>
            This removes the customer from your records. You can&apos;t undo this.
          </DialogDescription>
        </DialogHeader>

        {error && !isPending && (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error.code === '23503'
              ? "This customer has quotes or invoices and can't be deleted."
              : error.message ?? 'Could not delete customer.'}
          </p>
        )}

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
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
