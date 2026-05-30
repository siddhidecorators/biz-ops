'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PickerField } from '@/components/ui/picker-field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { INDIAN_STATES } from '@/lib/india';
import { saveOnboarding, type OnboardingFormState } from './actions';

export type OrgRow = {
  id: string;
  name: string;
  gstin: string | null;
  pan: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  signatory_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  upi_id: string | null;
  settings_complete: boolean;
};

const initialState: OnboardingFormState = { ok: false };

export function OnboardingForm({
  org,
  defaultSignatory,
  defaultEmail,
  submitLabel = 'Save and continue',
}: {
  org: OrgRow;
  defaultSignatory: string;
  defaultEmail: string;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(saveOnboarding, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field name="name" label="Business name" required defaultValue={org.name} error={state.fieldErrors?.name} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field name="phone" label="Phone" type="tel" inputMode="tel" defaultValue={org.phone ?? ''} />
            <Field name="email" label="Email" type="email" inputMode="email" defaultValue={org.email ?? defaultEmail} error={state.fieldErrors?.email} />
          </div>
          <Field name="signatory_name" label="Authorised signatory" defaultValue={org.signatory_name ?? defaultSignatory} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tax & address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field name="gstin" label="GSTIN" placeholder="07ABCDE1234F1Z5" defaultValue={org.gstin ?? ''} uppercase error={state.fieldErrors?.gstin} />
            <Field name="pan" label="PAN" placeholder="ABCDE1234F" defaultValue={org.pan ?? ''} uppercase error={state.fieldErrors?.pan} />
          </div>
          <Field name="address_line1" label="Address line 1" defaultValue={org.address_line1 ?? ''} />
          <Field name="address_line2" label="Address line 2" defaultValue={org.address_line2 ?? ''} />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field name="city" label="City" defaultValue={org.city ?? ''} />
            <div className="space-y-1">
              <Label htmlFor="state">State / UT</Label>
              <PickerField
                id="state"
                name="state"
                label="State / UT"
                placeholder="Pick a state"
                searchable
                defaultValue={org.state ?? ''}
                options={INDIAN_STATES.map((s) => ({ value: s.code, label: s.name }))}
              />
              {state.fieldErrors?.state && <p className="text-xs text-destructive">{state.fieldErrors.state}</p>}
            </div>
            <Field name="pincode" label="Pincode" inputMode="numeric" defaultValue={org.pincode ?? ''} error={state.fieldErrors?.pincode} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment details</CardTitle>
          <p className="text-xs text-muted-foreground">Optional — shown on invoices so customers can pay you.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field name="bank_account_name" label="Account holder name" defaultValue={org.bank_account_name ?? ''} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field name="bank_account_number" label="Account number" inputMode="numeric" defaultValue={org.bank_account_number ?? ''} />
            <Field name="bank_ifsc" label="IFSC" placeholder="HDFC0001234" defaultValue={org.bank_ifsc ?? ''} uppercase error={state.fieldErrors?.bank_ifsc} />
          </div>
          <Field name="bank_name" label="Bank name" defaultValue={org.bank_name ?? ''} />
          <Field name="upi_id" label="UPI ID" placeholder="business@upi" defaultValue={org.upi_id ?? ''} />
        </CardContent>
      </Card>

      {state.formError && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {state.formError}
        </p>
      )}

      <Button type="submit" disabled={pending} className="h-12 w-full text-base" size="lg">
        {pending ? 'Saving…' : submitLabel}
      </Button>
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
  error,
}: {
  name: string;
  label: string;
  type?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'numeric';
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  uppercase?: boolean;
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
        defaultValue={defaultValue}
        required={required}
        autoCapitalize={uppercase ? 'characters' : undefined}
        className={`h-11${uppercase ? ' uppercase' : ''}`}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
