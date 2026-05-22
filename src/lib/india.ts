export type IndianState = {
  code: string;
  name: string;
  gstStateCode: string;
  kind: 'state' | 'ut';
};

export const INDIAN_STATES: readonly IndianState[] = [
  { code: 'JK', name: 'Jammu and Kashmir', gstStateCode: '01', kind: 'ut' },
  { code: 'HP', name: 'Himachal Pradesh', gstStateCode: '02', kind: 'state' },
  { code: 'PB', name: 'Punjab', gstStateCode: '03', kind: 'state' },
  { code: 'CH', name: 'Chandigarh', gstStateCode: '04', kind: 'ut' },
  { code: 'UK', name: 'Uttarakhand', gstStateCode: '05', kind: 'state' },
  { code: 'HR', name: 'Haryana', gstStateCode: '06', kind: 'state' },
  { code: 'DL', name: 'Delhi', gstStateCode: '07', kind: 'ut' },
  { code: 'RJ', name: 'Rajasthan', gstStateCode: '08', kind: 'state' },
  { code: 'UP', name: 'Uttar Pradesh', gstStateCode: '09', kind: 'state' },
  { code: 'BR', name: 'Bihar', gstStateCode: '10', kind: 'state' },
  { code: 'SK', name: 'Sikkim', gstStateCode: '11', kind: 'state' },
  { code: 'AR', name: 'Arunachal Pradesh', gstStateCode: '12', kind: 'state' },
  { code: 'NL', name: 'Nagaland', gstStateCode: '13', kind: 'state' },
  { code: 'MN', name: 'Manipur', gstStateCode: '14', kind: 'state' },
  { code: 'MZ', name: 'Mizoram', gstStateCode: '15', kind: 'state' },
  { code: 'TR', name: 'Tripura', gstStateCode: '16', kind: 'state' },
  { code: 'ML', name: 'Meghalaya', gstStateCode: '17', kind: 'state' },
  { code: 'AS', name: 'Assam', gstStateCode: '18', kind: 'state' },
  { code: 'WB', name: 'West Bengal', gstStateCode: '19', kind: 'state' },
  { code: 'JH', name: 'Jharkhand', gstStateCode: '20', kind: 'state' },
  { code: 'OD', name: 'Odisha', gstStateCode: '21', kind: 'state' },
  { code: 'CG', name: 'Chhattisgarh', gstStateCode: '22', kind: 'state' },
  { code: 'MP', name: 'Madhya Pradesh', gstStateCode: '23', kind: 'state' },
  { code: 'GJ', name: 'Gujarat', gstStateCode: '24', kind: 'state' },
  { code: 'DN', name: 'Dadra and Nagar Haveli and Daman and Diu', gstStateCode: '26', kind: 'ut' },
  { code: 'MH', name: 'Maharashtra', gstStateCode: '27', kind: 'state' },
  { code: 'KA', name: 'Karnataka', gstStateCode: '29', kind: 'state' },
  { code: 'GA', name: 'Goa', gstStateCode: '30', kind: 'state' },
  { code: 'LD', name: 'Lakshadweep', gstStateCode: '31', kind: 'ut' },
  { code: 'KL', name: 'Kerala', gstStateCode: '32', kind: 'state' },
  { code: 'TN', name: 'Tamil Nadu', gstStateCode: '33', kind: 'state' },
  { code: 'PY', name: 'Puducherry', gstStateCode: '34', kind: 'ut' },
  { code: 'AN', name: 'Andaman and Nicobar Islands', gstStateCode: '35', kind: 'ut' },
  { code: 'TS', name: 'Telangana', gstStateCode: '36', kind: 'state' },
  { code: 'AP', name: 'Andhra Pradesh', gstStateCode: '37', kind: 'state' },
  { code: 'LA', name: 'Ladakh', gstStateCode: '38', kind: 'ut' },
];

export const STATE_BY_CODE: Record<string, IndianState> = Object.fromEntries(
  INDIAN_STATES.map((s) => [s.code, s]),
);

export const STATE_BY_GST_CODE: Record<string, IndianState> = Object.fromEntries(
  INDIAN_STATES.map((s) => [s.gstStateCode, s]),
);

// Delhi NCR — Pankaj's day-to-day service zone. Order: Delhi (intra-state)
// first, then the three NCR neighbours where IGST kicks in. Shown at the top
// of any Indian-state picker so the common choices are one tap away.
export const NCR_STATE_CODES = ['DL', 'HR', 'UP', 'RJ'] as const;

export const NCR_STATES: readonly IndianState[] = NCR_STATE_CODES.map(
  (code) => STATE_BY_CODE[code],
);

export const NON_NCR_STATES: readonly IndianState[] = INDIAN_STATES.filter(
  (s) => !(NCR_STATE_CODES as readonly string[]).includes(s.code),
)
  .slice()
  .sort((a, b) => a.name.localeCompare(b.name));

export const DEFAULT_CUSTOMER_STATE = 'DL';

export function gstinStateCode(gstin: string | null | undefined): string | null {
  if (!gstin || gstin.length < 2) return null;
  return gstin.slice(0, 2);
}

export function stateFromGstin(gstin: string | null | undefined): IndianState | null {
  const code = gstinStateCode(gstin);
  return code ? STATE_BY_GST_CODE[code] ?? null : null;
}

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export function isValidGstinFormat(gstin: string): boolean {
  return GSTIN_RE.test(gstin);
}

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export function isValidPanFormat(pan: string): boolean {
  return PAN_RE.test(pan);
}

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export function isValidIfscFormat(ifsc: string): boolean {
  return IFSC_RE.test(ifsc);
}

const PINCODE_RE = /^[1-9][0-9]{5}$/;
export function isValidPincodeFormat(pincode: string): boolean {
  return PINCODE_RE.test(pincode);
}
