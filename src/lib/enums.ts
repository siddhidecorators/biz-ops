// Union types that mirror the Postgres ENUMs in 0001_init.sql.
// Keep in sync if the SQL enums change.

export const CUSTOMER_TYPES = ['homeowner', 'designer', 'builder', 'other'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  homeowner: 'Homeowner',
  designer: 'Designer',
  builder: 'Builder',
  other: 'Other',
};

export const CRAFTS = [
  // Decorative crafts
  'wallpaper',
  'wooden_flooring',
  'pvc_flooring',
  'pvc_panel',
  'wpc_louver',
  'fluted_panel',
  'carpet',
  'stretch_ceiling',
  'blinds',
  'curtains',
  'glass_film',
  'mosquito_mesh',
  'artificial_grass',
  'vertical_garden',
  // Service line items (added migration 0002)
  'labour_charge',
  'installation_charge',
  'cartage_charge',
  'stitching_charge',
  'repair_charge',
  'site_visit_charge',
  'polish_charge',
  'dismantling_charge',
] as const;
export type Craft = (typeof CRAFTS)[number];

export const CRAFT_LABELS: Record<Craft, string> = {
  wallpaper: 'Wallpaper',
  wooden_flooring: 'Wooden flooring',
  pvc_flooring: 'PVC flooring',
  pvc_panel: 'PVC wall panel',
  wpc_louver: 'WPC charcoal louver',
  fluted_panel: 'Fluted panel',
  carpet: 'Carpet',
  stretch_ceiling: 'Stretch ceiling',
  blinds: 'Window blind',
  curtains: 'Curtain',
  glass_film: 'Glass film',
  mosquito_mesh: 'Mosquito mesh',
  artificial_grass: 'Artificial grass',
  vertical_garden: 'Vertical garden',
  labour_charge: 'Labour charge',
  installation_charge: 'Installation charge',
  cartage_charge: 'Cartage / transport',
  stitching_charge: 'Stitching charge',
  repair_charge: 'Repair charge',
  site_visit_charge: 'Site visit fee',
  polish_charge: 'Polish / finishing',
  dismantling_charge: 'Dismantling charge',
};

export const CRAFT_GROUPS: Record<string, Craft[]> = {
  Walls: ['wallpaper', 'pvc_panel', 'wpc_louver', 'fluted_panel'],
  Floors: ['wooden_flooring', 'pvc_flooring', 'carpet'],
  Windows: ['blinds', 'curtains', 'glass_film', 'mosquito_mesh'],
  Ceilings: ['stretch_ceiling'],
  Outdoor: ['artificial_grass', 'vertical_garden'],
  Services: [
    'labour_charge',
    'installation_charge',
    'stitching_charge',
    'polish_charge',
    'repair_charge',
    'dismantling_charge',
    'cartage_charge',
    'site_visit_charge',
  ],
};

export const UNITS = [
  'sq_ft',
  'sq_meter',
  'running_ft',
  'running_meter',
  'piece',
  'set',
  'roll',
  'meter',
] as const;
export type Unit = (typeof UNITS)[number];

export const UNIT_LABELS: Record<Unit, string> = {
  sq_ft: 'sq ft',
  sq_meter: 'sq m',
  running_ft: 'running ft',
  running_meter: 'running m',
  piece: 'pcs',
  set: 'set',
  roll: 'roll',
  meter: 'm',
};

export const ORG_ROLES = ['owner', 'admin', 'staff'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];
export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  staff: 'Staff',
};

export const QUOTE_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'declined',
  'converted_to_invoice',
  'expired',
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  declined: 'Declined',
  converted_to_invoice: 'Converted',
  expired: 'Expired',
};

export const INVOICE_STATUSES = ['draft', 'issued', 'cancelled'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
};

export const PAYMENT_MODES = ['cash', 'upi', 'bank_transfer', 'cheque', 'card', 'other'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
  card: 'Card',
  other: 'Other',
};

export type GstType = 'intra_state' | 'inter_state';

export const LEAD_STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  quoted: 'Quoted',
  won: 'Won',
  lost: 'Lost',
};
