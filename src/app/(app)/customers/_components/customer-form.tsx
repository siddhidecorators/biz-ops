'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NCR_STATES, NON_NCR_STATES } from '@/lib/india';
import { CUSTOMER_TYPES, CUSTOMER_TYPE_LABELS } from '@/lib/enums';
import type { CustomerFormState } from '../actions';

export type CustomerDefaults = {
  name?: string;
  customer_type?: string;
  phone?: string;
  alt_phone?: string;
  email?: string;
  gstin?: string;
  billing_address_line1?: string;
  billing_address_line2?: string;
  billing_city?: string;
  billing_state?: string;
  billing_pincode?: string;
  notes?: string;
};

const initialState: CustomerFormState = { ok: false };

export function CustomerForm({
  action,
  defaults,
  submitLabel,
  trailing,
}: {
  action: (
    prev: CustomerFormState | null,
    formData: FormData,
  ) => Promise<CustomerFormState>;
  defaults?: CustomerDefaults;
  submitLabel: string;
  trailing?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const d = defaults ?? {};

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            name="name"
            label="Name"
            required
            defaultValue={d.name}
            error={state.fieldErrors?.name}
            autoFocus
          />
          <div className="space-y-1">
            <Label htmlFor="customer_type">Type</Label>
            <Select name="customer_type" defaultValue={d.customer_type ?? 'homeowner'}>
              <SelectTrigger id="customer_type" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMER_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {CUSTOMER_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.fieldErrors?.customer_type && (
              <p className="text-xs text-destructive">{state.fieldErrors.customer_type}</p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              name="phone"
              label="Phone"
              type="tel"
              inputMode="tel"
              required
              defaultValue={d.phone}
              error={state.fieldErrors?.phone}
            />
            <Field
              name="alt_phone"
              label="Alt phone"
              type="tel"
              inputMode="tel"
              defaultValue={d.alt_phone}
              error={state.fieldErrors?.alt_phone}
            />
          </div>
          <Field
            name="email"
            label="Email"
            type="email"
            inputMode="email"
            defaultValue={d.email}
            error={state.fieldErrors?.email}
          />
          <Field
            name="gstin"
            label="GSTIN (for B2B customers)"
            placeholder="07ABCDE1234F1Z5"
            defaultValue={d.gstin}
            uppercase
            error={state.fieldErrors?.gstin}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billing address</CardTitle>
          <p className="text-xs text-muted-foreground">
            State is used to pick CGST+SGST vs IGST on invoices.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            name="billing_address_line1"
            label="Address line 1"
            defaultValue={d.billing_address_line1}
          />
          <Field
            name="billing_address_line2"
            label="Address line 2"
            defaultValue={d.billing_address_line2}
          />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field name="billing_city" label="City" defaultValue={d.billing_city} />
            <div className="space-y-1">
              <Label htmlFor="billing_state">State / UT</Label>
              <Select name="billing_state" defaultValue={d.billing_state ?? ''}>
                <SelectTrigger id="billing_state" className="h-11">
                  <SelectValue placeholder="Pick a state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Delhi NCR</SelectLabel>
                    {NCR_STATES.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Other states / UTs</SelectLabel>
                    {NON_NCR_STATES.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {state.fieldErrors?.billing_state && (
                <p className="text-xs text-destructive">{state.fieldErrors.billing_state}</p>
              )}
            </div>
            <Field
              name="billing_pincode"
              label="Pincode"
              inputMode="numeric"
              defaultValue={d.billing_pincode}
              error={state.fieldErrors?.billing_pincode}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="notes"
            name="notes"
            defaultValue={d.notes ?? ''}
            placeholder="Anything worth remembering — site contact, preferences, gate code…"
            rows={3}
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
          {pending ? 'Saving…' : submitLabel}
        </Button>
        <Link
          href="/customers"
          className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-12')}
        >
          Cancel
        </Link>
      </div>

      {trailing}
    </form>
  );
}

function Field({
  name,
  label,
  type = 'text',
  inputMode,
  placeholder,
  defaultValue,
  required,
  uppercase,
  autoFocus,
  error,
}: {
  name: string;
  label: string;
  type?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'numeric' | 'search';
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  uppercase?: boolean;
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
        autoCapitalize={uppercase ? 'characters' : undefined}
        className={`h-11${uppercase ? ' uppercase' : ''}`}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
