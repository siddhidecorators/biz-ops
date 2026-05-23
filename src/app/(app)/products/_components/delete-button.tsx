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
import { productKeys, type ProductListRow } from '@/lib/queries/products';

type Snapshot = ReadonlyArray<[readonly unknown[], ProductListRow[] | undefined]>;

export function DeleteProductButton({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
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
        .from('product_templates')
        .delete()
        .eq('id', productId);
      if (deleteError) throw deleteError;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: productKeys.all });

      const snapshots = queryClient.getQueriesData<ProductListRow[]>({
        queryKey: productKeys.lists(),
      });
      for (const [key, data] of snapshots) {
        if (!data) continue;
        queryClient.setQueryData(
          key,
          data.filter((row) => row.id !== productId),
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
          ? 'This template is referenced by quote or invoice lines. Mark it inactive instead.'
          : err?.message ?? 'Could not delete template.';
      toast.error(friendly);
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: productKeys.detail(productId) });
      toast.success('Template deleted');
      setOpen(false);
      router.push('/products');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
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
        Delete template
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{productName}&rdquo;?</DialogTitle>
          <DialogDescription>
            If this template is on any quote or invoice, delete will fail — mark it inactive
            instead.
          </DialogDescription>
        </DialogHeader>

        {error && !isPending && (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error.code === '23503'
              ? 'This template is referenced by quote or invoice lines. Mark it inactive instead.'
              : error.message ?? 'Could not delete template.'}
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
