'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatINR, formatDateDMY } from '@/lib/format';
import { EXPENSE_CATEGORY_LABELS } from '@/lib/enums';
import { expenseKeys, fetchExpenses, type ExpenseListRow } from '@/lib/queries/expenses';
import { createClient } from '@/lib/supabase/browser';
import { AppBar } from '../../_components/app-bar';

export function ExpensesList({ initialData }: { initialData?: ExpenseListRow[] }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: expenseKeys.list(),
    queryFn: () => fetchExpenses(),
    initialData,
  });

  const expenses = data ?? [];
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <>
      <AppBar
        title="Expenses"
        subtitle={expenses.length > 0 ? `${formatINR(total)} total` : undefined}
        right={
          <Link
            href="/expenses/new"
            aria-label="Add expense"
            className="inline-flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 active:opacity-90"
          >
            <PlusIcon className="size-5" />
          </Link>
        }
      />

      <main className="mx-auto max-w-md px-6 py-5">
        {isError ? (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error instanceof Error ? error.message : 'Something went wrong.'}
          </p>
        ) : isPending ? (
          <Skeleton />
        ) : expenses.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-2.5">
            {expenses.map((e) => (
              <ExpenseRow key={e.id} expense={e} />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function Skeleton() {
  return (
    <ul aria-hidden className="space-y-2.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i}>
          <Card size="sm">
            <CardContent className="space-y-2">
              <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
              <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
      <p className="text-base font-medium">No expenses yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Log material, labour and transport costs — link them to an invoice to see your profit on
        each job.
      </p>
      <Link
        href="/expenses/new"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
      >
        Add your first expense
      </Link>
    </div>
  );
}

function ExpenseRow({ expense: e }: { expense: ExpenseListRow }) {
  const queryClient = useQueryClient();

  const { mutate: remove, isPending } = useMutation<
    void,
    Error,
    void,
    { previous: ExpenseListRow[] | undefined }
  >({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase.from('expenses').delete().eq('id', e.id);
      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: expenseKeys.list() });
      const previous = queryClient.getQueryData<ExpenseListRow[]>(expenseKeys.list());
      queryClient.setQueryData<ExpenseListRow[]>(expenseKeys.list(), (c) =>
        (c ?? []).filter((r) => r.id !== e.id),
      );
      return { previous };
    },
    onError: (_err, _v, ctx) => {
      if (ctx) queryClient.setQueryData(expenseKeys.list(), ctx.previous);
      toast.error('Could not delete the expense.');
    },
    onSuccess: () => toast.success('Expense deleted'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: expenseKeys.list() }),
  });

  const sub = [
    e.vendor,
    e.bill_number ? `Bill ${e.bill_number}` : null,
    e.description,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li>
      <Card size="sm">
        <CardContent className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-base font-medium">{formatINR(e.amount)}</p>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {EXPENSE_CATEGORY_LABELS[e.category]}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {sub ? `${sub} · ` : ''}
              {formatDateDMY(e.expense_date)}
              {e.invoices?.invoice_number && ` · ${e.invoices.invoice_number}`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete expense"
            disabled={isPending}
            onClick={() => remove()}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2Icon className="size-4" />
          </Button>
        </CardContent>
      </Card>
    </li>
  );
}
