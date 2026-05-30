'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { PickerField } from '@/components/ui/picker-field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CRAFT_GROUPS,
  CRAFT_LABELS,
  UNITS,
  UNIT_LABELS,
  type Craft,
  type Unit,
} from '@/lib/enums';
import { cn } from '@/lib/utils';
import type { ProductFormState } from '../actions';

export type ProductDefaults = {
  name?: string;
  brand?: string;
  craft?: string;
  unit?: string;
  hsn_sac_code?: string;
  default_rate?: string;
  tax_rate_percent?: string;
  verified?: boolean;
  is_active?: boolean;
  notes?: string;
};

const initialState: ProductFormState = { ok: false };

export function ProductForm({
  action,
  defaults,
  submitLabel,
  showActiveToggle = false,
  trailing,
}: {
  action: (
    prev: ProductFormState | null,
    formData: FormData,
  ) => Promise<ProductFormState>;
  defaults?: ProductDefaults;
  submitLabel: string;
  showActiveToggle?: boolean;
  trailing?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const d = defaults ?? {};

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TextField
            name="name"
            label="Name"
            required
            defaultValue={d.name}
            placeholder="e.g. Excel premium wallpaper roll"
            error={state.fieldErrors?.name}
            autoFocus
          />
          <TextField
            name="brand"
            label="Brand"
            defaultValue={d.brand}
            placeholder="e.g. Excel, Asian Paints Nilaya"
            error={state.fieldErrors?.brand}
          />
          <div className="space-y-1">
            <Label htmlFor="craft">Craft</Label>
            <PickerField
              id="craft"
              name="craft"
              label="Craft"
              placeholder="Pick a craft"
              searchable
              defaultValue={d.craft ?? ''}
              groups={Object.entries(CRAFT_GROUPS).map(([chapter, crafts]) => ({
                label: chapter,
                options: crafts.map((c: Craft) => ({ value: c, label: CRAFT_LABELS[c] })),
              }))}
            />
            {state.fieldErrors?.craft && (
              <p className="text-xs text-destructive">{state.fieldErrors.craft}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="unit">Unit of measure</Label>
            <PickerField
              id="unit"
              name="unit"
              label="Unit of measure"
              placeholder="Pick a unit"
              defaultValue={d.unit ?? ''}
              options={UNITS.map((u: Unit) => ({ value: u, label: UNIT_LABELS[u] }))}
            />
            {state.fieldErrors?.unit && (
              <p className="text-xs text-destructive">{state.fieldErrors.unit}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tax & rate</CardTitle>
          <p className="text-xs text-muted-foreground">
            Leave blank if you set rates per-line on each invoice. HSN/SAC and GST rate are not
            seeded — current values from your GST records.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <TextField
            name="hsn_sac_code"
            label="HSN / SAC code"
            inputMode="numeric"
            defaultValue={d.hsn_sac_code}
            placeholder="e.g. 4814"
            error={state.fieldErrors?.hsn_sac_code}
          />
          <div className="grid grid-cols-2 gap-4">
            <TextField
              name="default_rate"
              label="Default rate (₹)"
              inputMode="decimal"
              defaultValue={d.default_rate}
              placeholder="0.00"
              error={state.fieldErrors?.default_rate}
            />
            <TextField
              name="tax_rate_percent"
              label="GST rate (%)"
              inputMode="decimal"
              defaultValue={d.tax_rate_percent}
              placeholder="0"
              error={state.fieldErrors?.tax_rate_percent}
            />
          </div>
          <ToggleRow
            id="verified"
            name="verified"
            label="Verified"
            description="I have checked the HSN/SAC and GST rate against current records."
            defaultChecked={d.verified ?? false}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            id="notes"
            name="notes"
            defaultValue={d.notes ?? ''}
            placeholder="Supplier, lead time, anything worth remembering…"
            rows={3}
          />
          {showActiveToggle && (
            <ToggleRow
              id="is_active"
              name="is_active"
              label="Active"
              description="Inactive templates stay in history but don't show up when adding lines."
              defaultChecked={d.is_active ?? true}
            />
          )}
        </CardContent>
      </Card>

      {state.formError && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {state.formError}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} size="lg" className="h-12 flex-1 text-base">
          {pending ? 'Saving…' : submitLabel}
        </Button>
        <Link
          href="/products"
          className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-12')}
        >
          Cancel
        </Link>
      </div>

      {trailing}
    </form>
  );
}

function TextField({
  name,
  label,
  type = 'text',
  inputMode,
  placeholder,
  defaultValue,
  required,
  autoFocus,
  error,
}: {
  name: string;
  label: string;
  type?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'numeric' | 'decimal' | 'search';
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  autoFocus?: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ''}
        required={required}
        autoFocus={autoFocus}
        className="h-11"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ToggleRow({
  id,
  name,
  label,
  description,
  defaultChecked,
}: {
  id: string;
  name: string;
  label: string;
  description?: string;
  defaultChecked: boolean;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <Checkbox id={id} name={name} defaultChecked={defaultChecked} className="mt-0.5" />
      <span className="flex-1 space-y-0.5">
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
    </label>
  );
}
