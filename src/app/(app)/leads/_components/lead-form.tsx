'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PickerField } from '@/components/ui/picker-field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from '@/lib/enums';
import type { LeadFormState } from '../actions';

export type LeadDefaults = {
  name?: string;
  phone?: string;
  email?: string;
  source?: string;
  note?: string;
  status?: string;
};

const initialState: LeadFormState = { ok: false };

export function LeadForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: LeadFormState | null, formData: FormData) => Promise<LeadFormState>;
  defaults?: LeadDefaults;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const d = defaults ?? {};

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inquiry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input id="name" name="name" defaultValue={d.name} required autoFocus className="h-11" />
            {state.fieldErrors?.name && (
              <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={d.phone} className="h-11" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" inputMode="email" defaultValue={d.email} className="h-11" />
              {state.fieldErrors?.email && (
                <p className="text-xs text-destructive">{state.fieldErrors.email}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="source">Source</Label>
              <Input
                id="source"
                name="source"
                defaultValue={d.source}
                placeholder="Walk-in, WhatsApp, referral…"
                className="h-11"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="status">Status</Label>
              <PickerField
                id="status"
                name="status"
                label="Status"
                defaultValue={d.status ?? 'new'}
                options={LEAD_STATUSES.map((s) => ({
                  value: s,
                  label: LEAD_STATUS_LABELS[s],
                }))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              name="note"
              defaultValue={d.note ?? ''}
              placeholder="What are they looking for? Budget, site, timeline…"
              rows={3}
            />
          </div>
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
        <Link href="/leads" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-12')}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
