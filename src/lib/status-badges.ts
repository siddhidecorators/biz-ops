// Single source of truth mapping each status enum to a semantic Badge variant,
// so quotes / leads / invoices all speak the same warm colour language. Pair
// with the *_LABELS from enums.ts (re-exported here) at every render site:
//
//   <Badge variant={QUOTE_BADGE[q.status]} size="sm" className="uppercase">
//     {QUOTE_STATUS_LABELS[q.status]}
//   </Badge>
//
// Colour logic: neutral = idle (draft/lost), info (calm blue) = in-flight with
// no action yet (sent/new), warning = needs attention (expired/contacted/
// partial), success = good outcome (accepted/won/paid), danger = bad outcome
// (declined/unpaid), brand (terracotta) = the identity-change states
// (converted/quoted).

import {
  QUOTE_STATUS_LABELS,
  LEAD_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type QuoteStatus,
  type LeadStatus,
  type PaymentStatus,
} from '@/lib/enums';

export type BadgeVariant =
  | 'neutral'
  | 'brand'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'outline';

export const QUOTE_BADGE: Record<QuoteStatus, BadgeVariant> = {
  draft: 'neutral',
  sent: 'info',
  accepted: 'success',
  declined: 'danger',
  converted_to_invoice: 'brand',
  expired: 'warning',
};

export const LEAD_BADGE: Record<LeadStatus, BadgeVariant> = {
  new: 'info',
  contacted: 'warning',
  quoted: 'brand',
  won: 'success',
  lost: 'neutral',
};

export const PAYMENT_BADGE: Record<PaymentStatus, BadgeVariant> = {
  unpaid: 'danger',
  partial: 'warning',
  paid: 'success',
};

export { QUOTE_STATUS_LABELS, LEAD_STATUS_LABELS, PAYMENT_STATUS_LABELS };
