'use client';

import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';
import { Trash2Icon } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PickerField } from '@/components/ui/picker-field';
import { cn } from '@/lib/utils';
import { formatINR, round2, roundOffToRupee } from '@/lib/format';
import { UNITS, UNIT_LABELS, type Unit } from '@/lib/enums';
import { createInvoice, type InvoiceFormState } from '../actions';
import type { CustomerOption, TemplateOption } from '../../quotes/_components/quote-form';
import { PaymentPlanEditor } from './payment-plan-editor';
import { validatePlan, type MilestoneDraft } from '@/lib/milestones';

type LineDraft = {
  uid: string;
  template_id: string | null;
  description: string;
  hsn_sac_code: string;
  unit: Unit | '';
  quantity: string;
  rate: string;
  tax_rate_percent: string;
};

const randomUid = () => Math.random().toString(36).slice(2, 10);

const blankLine = (uid: string): LineDraft => ({
  uid,
  template_id: null,
  description: '',
  hsn_sac_code: '',
  unit: '',
  quantity: '',
  rate: '',
  tax_rate_percent: '',
});

const initialState: InvoiceFormState = { ok: false };

export function InvoiceForm({
  customers,
  templates,
  orgState,
  defaultCustomerId,
  today,
}: {
  customers: CustomerOption[];
  templates: TemplateOption[];
  orgState: string | null;
  defaultCustomerId?: string | null;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(createInvoice, initialState);

  const [customerId, setCustomerId] = useState<string>(defaultCustomerId ?? '');
  const [issueDate, setIssueDate] = useState(today);
  const [lines, setLines] = useState<LineDraft[]>([blankLine('L0')]);
  const [plan, setPlan] = useState<MilestoneDraft[]>([]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) ?? null,
    [customerId, customers],
  );

  const isIntraState =
    !!orgState && !!selectedCustomer?.billing_state && orgState === selectedCustomer.billing_state;

  const totals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    for (const l of lines) {
      const qty = Number(l.quantity);
      const rate = Number(l.rate);
      const tax = Number(l.tax_rate_percent);
      if (!Number.isFinite(qty) || !Number.isFinite(rate)) continue;
      const amount = round2(qty * rate);
      const taxAmount = round2((amount * (Number.isFinite(tax) ? tax : 0)) / 100);
      subtotal += amount;
      taxTotal += taxAmount;
    }
    subtotal = round2(subtotal);
    taxTotal = round2(taxTotal);
    const gross = round2(subtotal + taxTotal);
    const { rounded, diff } = roundOffToRupee(gross);
    return {
      subtotal,
      taxTotal,
      cgst: isIntraState ? round2(taxTotal / 2) : 0,
      sgst: isIntraState ? round2(taxTotal / 2) : 0,
      igst: isIntraState ? 0 : taxTotal,
      roundOff: diff,
      total: rounded,
    };
  }, [lines, isIntraState]);

  const linesPayload = useMemo(
    () =>
      JSON.stringify(
        lines.map((l) => ({
          template_id: l.template_id,
          description: l.description,
          hsn_sac_code: l.hsn_sac_code,
          unit: l.unit,
          quantity: l.quantity,
          rate: l.rate,
          tax_rate_percent: l.tax_rate_percent,
        })),
      ),
    [lines],
  );

  const planError = useMemo(() => validatePlan(plan, totals.total), [plan, totals.total]);

  function updateLine(uid: string, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  }

  function applyTemplate(uid: string, templateId: string) {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    updateLine(uid, {
      template_id: t.id,
      description: `${t.name}${t.brand ? ` — ${t.brand}` : ''}`,
      hsn_sac_code: t.hsn_sac_code ?? '',
      unit: t.unit,
      rate: t.default_rate != null ? String(t.default_rate) : '',
      tax_rate_percent: t.tax_rate_percent != null ? String(t.tax_rate_percent) : '',
    });
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="lines" value={linesPayload} />
      <input type="hidden" name="milestones" value={JSON.stringify(plan)} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bill to</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="customer_id">Customer</Label>
            <PickerField
              id="customer_id"
              name="customer_id"
              label="Choose customer"
              placeholder="Pick a customer"
              value={customerId}
              onValueChange={setCustomerId}
              searchable
              options={customers.map((c) => ({
                value: c.id,
                label: c.name,
                hint: c.billing_city ?? undefined,
              }))}
            />
            {state.fieldErrors?.customer_id && (
              <p className="text-xs text-destructive">{state.fieldErrors.customer_id}</p>
            )}
            {selectedCustomer && (
              <p className="pt-1 text-xs text-muted-foreground">
                {selectedCustomer.phone}
                {selectedCustomer.billing_state &&
                  ` · ${selectedCustomer.billing_state}${
                    isIntraState ? ' · CGST + SGST' : ' · IGST'
                  }`}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="issue_date">Invoice date</Label>
              <Input
                id="issue_date"
                name="issue_date"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="h-11"
              />
              {state.fieldErrors?.issue_date && (
                <p className="text-xs text-destructive">{state.fieldErrors.issue_date}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="project_label">Project (optional)</Label>
              <Input
                id="project_label"
                name="project_label"
                placeholder="e.g. Rohini flat"
                className="h-11"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
          <p className="text-xs text-muted-foreground">
            Pick a saved product to pre-fill, then tweak per line.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {lines.map((line, i) => (
            <LineItemCard
              key={line.uid}
              index={i}
              line={line}
              templates={templates}
              canRemove={lines.length > 1}
              error={state.lineErrors?.[i]}
              onApplyTemplate={(tid) => applyTemplate(line.uid, tid)}
              onPatch={(patch) => updateLine(line.uid, patch)}
              onRemove={() => setLines((prev) => prev.filter((l) => l.uid !== line.uid))}
            />
          ))}

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11 w-full"
            onClick={() => setLines((prev) => [...prev, blankLine(randomUid())])}
          >
            Add another line
          </Button>
          {typeof state.fieldErrors?.lines === 'string' && (
            <p className="text-xs text-destructive">{state.fieldErrors.lines}</p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-brand-tint/30">
        <CardHeader>
          <CardTitle className="text-base">Totals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <TotalRow label="Subtotal" value={totals.subtotal} />
          {isIntraState ? (
            <>
              <TotalRow label="CGST" value={totals.cgst} muted />
              <TotalRow label="SGST" value={totals.sgst} muted />
            </>
          ) : (
            <TotalRow label="IGST" value={totals.igst} muted />
          )}
          <TotalRow label="Round off" value={totals.roundOff} muted />
          <div className="mt-2 border-t border-border pt-2">
            <TotalRow label="Total" value={totals.total} emphasize />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment plan</CardTitle>
          <p className="text-xs text-muted-foreground">
            Optional — collect an advance now and the balance later, or set your
            own milestones. Leave on “Full payment” for a single bill.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          <PaymentPlanEditor total={totals.total} onChange={setPlan} />
          {planError && plan.length > 0 && (
            <p className="text-xs text-destructive">{planError}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes (optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="notes"
            name="notes"
            placeholder="Anything to call out — payment terms, delivery window…"
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
          {pending ? 'Saving…' : 'Save invoice'}
        </Button>
        <Link
          href="/invoices"
          className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-12')}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function LineItemCard({
  index,
  line,
  templates,
  canRemove,
  error,
  onApplyTemplate,
  onPatch,
  onRemove,
}: {
  index: number;
  line: LineDraft;
  templates: TemplateOption[];
  canRemove: boolean;
  error?: Partial<Record<string, string>>;
  onApplyTemplate: (templateId: string) => void;
  onPatch: (patch: Partial<LineDraft>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Line {index + 1}
        </span>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label={`Remove line ${index + 1}`}
          >
            <Trash2Icon className="size-4" />
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {templates.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Use a saved product</Label>
            <PickerField
              label="Saved products"
              placeholder="Pick a product (optional)"
              value={line.template_id ?? ''}
              onValueChange={(v) => {
                if (v) onApplyTemplate(v);
              }}
              searchable
              options={templates.map((t) => ({
                value: t.id,
                label: `${t.name}${t.brand ? ` · ${t.brand}` : ''}`,
              }))}
            />
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor={`desc-${line.uid}`}>Description</Label>
          <Textarea
            id={`desc-${line.uid}`}
            value={line.description}
            onChange={(e) => onPatch({ description: e.target.value })}
            placeholder="What you're billing for"
            rows={2}
          />
          {error?.description && <p className="text-xs text-destructive">{error.description}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor={`hsn-${line.uid}`}>HSN / SAC</Label>
            <Input
              id={`hsn-${line.uid}`}
              value={line.hsn_sac_code}
              onChange={(e) => onPatch({ hsn_sac_code: e.target.value })}
              inputMode="numeric"
              className="h-11"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`unit-${line.uid}`}>Unit</Label>
            <PickerField
              id={`unit-${line.uid}`}
              label="Unit"
              placeholder="Pick"
              value={line.unit}
              onValueChange={(v) => onPatch({ unit: v as Unit })}
              options={UNITS.map((u) => ({ value: u, label: UNIT_LABELS[u] }))}
            />
            {error?.unit && <p className="text-xs text-destructive">{error.unit}</p>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor={`qty-${line.uid}`}>Qty</Label>
            <Input
              id={`qty-${line.uid}`}
              value={line.quantity}
              onChange={(e) => onPatch({ quantity: e.target.value })}
              inputMode="decimal"
              placeholder="0"
              className="h-11"
            />
            {error?.quantity && <p className="text-xs text-destructive">{error.quantity}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`rate-${line.uid}`}>Rate ₹</Label>
            <Input
              id={`rate-${line.uid}`}
              value={line.rate}
              onChange={(e) => onPatch({ rate: e.target.value })}
              inputMode="decimal"
              placeholder="0"
              className="h-11"
            />
            {error?.rate && <p className="text-xs text-destructive">{error.rate}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`tax-${line.uid}`}>GST %</Label>
            <Input
              id={`tax-${line.uid}`}
              value={line.tax_rate_percent}
              onChange={(e) => onPatch({ tax_rate_percent: e.target.value })}
              inputMode="decimal"
              placeholder="0"
              className="h-11"
            />
            {error?.tax_rate_percent && (
              <p className="text-xs text-destructive">{error.tax_rate_percent}</p>
            )}
          </div>
        </div>

        {(() => {
          const qty = Number(line.quantity);
          const rate = Number(line.rate);
          const tax = Number(line.tax_rate_percent);
          if (!Number.isFinite(qty) || !Number.isFinite(rate) || qty <= 0 || rate < 0) {
            return null;
          }
          const amount = round2(qty * rate);
          const taxAmount = round2((amount * (Number.isFinite(tax) ? tax : 0)) / 100);
          const total = round2(amount + taxAmount);
          return (
            <p className="rounded-md bg-muted/60 px-3 py-2 text-right text-xs text-muted-foreground">
              Line total: <span className="font-medium text-foreground">{formatINR(total)}</span>
              <span className="ml-2">
                ({formatINR(amount)} + GST {formatINR(taxAmount)})
              </span>
            </p>
          );
        })()}
      </div>
    </div>
  );
}

function TotalRow({
  label,
  value,
  muted,
  emphasize,
}: {
  label: string;
  value: number;
  muted?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between',
        muted && 'text-muted-foreground',
        emphasize && 'text-base font-semibold text-foreground',
      )}
    >
      <span>{label}</span>
      <span className={cn(emphasize && 'text-primary')}>{formatINR(value)}</span>
    </div>
  );
}
