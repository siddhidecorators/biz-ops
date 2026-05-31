'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PickerField } from '@/components/ui/picker-field';
import { cn } from '@/lib/utils';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from '@/lib/enums';
import { createExpense, type ExpenseFormState } from '../actions';

export type InvoiceOption = { id: string; label: string; hint?: string };

const initialState: ExpenseFormState = { ok: false };

export function ExpenseForm({
  invoices,
  defaultInvoiceId,
  today,
}: {
  invoices: InvoiceOption[];
  defaultInvoiceId: string | null;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(createExpense, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expense</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input
              id="amount"
              name="amount"
              inputMode="decimal"
              placeholder="0"
              className="h-11"
            />
            {state.fieldErrors?.amount && (
              <p className="text-xs text-destructive">{state.fieldErrors.amount}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="category">Category</Label>
              <PickerField
                id="category"
                name="category"
                label="Category"
                defaultValue="materials"
                options={EXPENSE_CATEGORIES.map((c) => ({
                  value: c,
                  label: EXPENSE_CATEGORY_LABELS[c],
                }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="expense_date">Date</Label>
              <Input
                id="expense_date"
                name="expense_date"
                type="date"
                defaultValue={today}
                className="h-11"
              />
              {state.fieldErrors?.expense_date && (
                <p className="text-xs text-destructive">{state.fieldErrors.expense_date}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="vendor">Paid to / vendor (optional)</Label>
            <Input
              id="vendor"
              name="vendor"
              placeholder="e.g. Asian Paints dealer"
              className="h-11"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">What was it for? (optional)</Label>
            <Textarea
              id="description"
              name="description"
              rows={2}
              placeholder="e.g. Wallpaper rolls for the Rohini flat"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Link to a project (optional)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Tie this cost to an invoice to see profit on that job.
          </p>
        </CardHeader>
        <CardContent>
          <PickerField
            name="invoice_id"
            label="Invoice"
            placeholder="Not linked to a project"
            searchable
            defaultValue={defaultInvoiceId ?? ''}
            options={[
              { value: '', label: 'Not linked to a project' },
              ...invoices.map((i) => ({ value: i.id, label: i.label, hint: i.hint })),
            ]}
          />
        </CardContent>
      </Card>

      {state.formError && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {state.formError}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} size="lg" className="h-12 flex-1 text-base">
          {pending ? 'Saving…' : 'Save expense'}
        </Button>
        <Link
          href="/expenses"
          className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-12')}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
