import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from '@react-pdf/renderer';
import { UNIT_LABELS, type Unit } from '@/lib/enums';
import {
  formatINRForPdf,
  formatDateDMY,
  round2,
  amountInIndianWords,
} from '@/lib/format';
import { STATE_BY_CODE } from '@/lib/india';

// react-pdf's built-in fonts (Helvetica, Times) predate the U+20B9 ₹ glyph, so
// currency used to render as "Rs 1,250.00". We bundle Roboto (regular + bold),
// which includes ₹, served from /public/fonts so there's no CDN dependency at
// render time. Roboto-Bold covers what used to be the serif display + bold body.
Font.register({ family: 'Roboto', src: '/fonts/Roboto-Regular.ttf' });
Font.register({ family: 'Roboto-Bold', src: '/fonts/Roboto-Bold.ttf' });
// react-pdf hyphenates by default; disable it so words/amounts don't get split.
Font.registerHyphenationCallback((word) => [word]);

const TERRACOTTA = '#B8552A';
const TERRACOTTA_DARK = '#7E3812';
const TERRACOTTA_SOFT = '#F4E6DD';
const CREAM = '#FBF7F2';
const INK = '#1A1410';
const INK_SOFT = '#3D332C';
const MUTED = '#7A716A';
const RULE = '#D9D2CC';
const RULE_HAIR = '#ECE6E0';

// Sensible defaults for an interior decorator's quotes and tax invoices.
// Used only when org.terms_text is empty — once Pankaj sets a custom Terms
// block in Settings, that replaces this list verbatim.
const DEFAULT_QUOTE_TERMS: string[] = [
  'This quotation is valid up to the date shown above. Pricing is subject to revision after that.',
  '50% advance on confirmation; balance payable on completion of work.',
  'Prices include GST as shown. Material rates may revise if the brand source price changes before order placement.',
  'Delivery and installation timeline will be confirmed after the advance is received.',
  'Site must be cleared and ready (walls clean and dry, electrical points marked) before installation. Civil and electrical work are not included unless explicitly quoted.',
  'Any work outside the listed scope (additional area, design changes, repairs) will be billed separately at mutually agreed rates.',
  'Wallpapers, carpets, stretch ceilings and custom-stitched items — once cut to size or installed — cannot be returned or exchanged.',
  'Warranty, if any, is as per the respective brand or manufacturer.',
  'Subject to Delhi jurisdiction.',
];

const DEFAULT_INVOICE_TERMS: string[] = [
  'Payment is due on receipt unless otherwise agreed in writing.',
  'Goods once delivered or installed are non-returnable.',
  'Interest @ 18% per annum is charged on payments overdue beyond 15 days.',
  'Warranty, if applicable, is as per the respective brand or manufacturer.',
  'Any installation defects or claims must be reported in writing within 7 days of installation.',
  'Subject to Delhi jurisdiction. E. & O. E.',
];

const styles = StyleSheet.create({
  // ─── Page shell ────────────────────────────────────────────────
  page: {
    fontFamily: 'Roboto',
    fontSize: 9,
    color: INK,
    padding: 32,
    paddingTop: 0,
    paddingBottom: 0,
  },

  // ─── Top band ──────────────────────────────────────────────────
  topBand: {
    height: 5,
    backgroundColor: TERRACOTTA,
    marginHorizontal: -32,
  },

  // ─── Header ────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 14,
    paddingBottom: 9,
    borderBottomWidth: 0.75,
    borderBottomColor: TERRACOTTA,
  },
  brandLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, maxWidth: 340 },
  logo: { width: 50, height: 50, objectFit: 'contain' },
  orgName: {
    fontFamily: 'Roboto-Bold',
    fontSize: 17,
    color: INK,
    letterSpacing: 0.8,
    lineHeight: 1.1,
  },
  tagline: {
    fontFamily: 'Roboto',
    fontSize: 9,
    color: TERRACOTTA,
    marginTop: 1,
    letterSpacing: 0.3,
  },
  orgAddress: {
    fontSize: 8.5,
    color: MUTED,
    marginTop: 5,
    lineHeight: 1.5,
  },
  orgContact: {
    fontSize: 8.5,
    color: MUTED,
    lineHeight: 1.55,
  },
  orgGstin: {
    fontSize: 8.5,
    color: INK_SOFT,
    marginTop: 4,
    fontFamily: 'Roboto-Bold',
    letterSpacing: 0.2,
  },

  // Doc type pill (right side of header)
  docTypeWrap: { alignItems: 'flex-end', minWidth: 200 },
  docType: {
    fontFamily: 'Roboto-Bold',
    fontSize: 22,
    color: TERRACOTTA,
    letterSpacing: 3.2,
    lineHeight: 1,
    textTransform: 'uppercase',
  },
  docNumber: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: 'Roboto-Bold',
    color: INK,
    letterSpacing: 0.5,
  },
  docMetaRow: { flexDirection: 'row', marginTop: 6, gap: 14 },
  docMetaCol: { alignItems: 'flex-end' },
  docMetaLabel: {
    fontSize: 7,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  docMetaValue: {
    fontSize: 9,
    color: INK,
    marginTop: 1,
  },

  // ─── Bill to / Ship to ─────────────────────────────────────────
  partiesRow: {
    flexDirection: 'row',
    paddingTop: 10,
    paddingBottom: 10,
    gap: 36,
  },
  partyCol: { flex: 1 },
  partyLabel: {
    fontSize: 7.5,
    color: TERRACOTTA,
    textTransform: 'uppercase',
    letterSpacing: 1.8,
    marginBottom: 4,
    fontFamily: 'Roboto-Bold',
  },
  partyName: {
    fontFamily: 'Roboto-Bold',
    fontSize: 13,
    color: INK,
    marginBottom: 3,
    letterSpacing: 0.2,
  },
  partyLine: { fontSize: 9, color: INK_SOFT, lineHeight: 1.5 },
  partyMuted: { fontSize: 8.5, color: MUTED, marginTop: 4, lineHeight: 1.5 },
  partyEmpty: {
    fontFamily: 'Roboto',
    fontSize: 9,
    color: MUTED,
    marginTop: 2,
  },

  // Project strip
  projectRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE_HAIR,
  },
  projectLabel: {
    fontSize: 7.5,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontFamily: 'Roboto-Bold',
  },
  projectValue: {
    fontSize: 10,
    color: INK,
    fontFamily: 'Roboto',
  },

  // ─── Lines table ───────────────────────────────────────────────
  table: { marginTop: 10 },
  thead: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 0,
    borderTopWidth: 1,
    borderTopColor: INK,
    borderBottomWidth: 0.5,
    borderBottomColor: INK,
  },
  th: {
    fontSize: 7.5,
    fontFamily: 'Roboto-Bold',
    color: INK,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 5.5,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE_HAIR,
  },
  td: { fontSize: 9, color: INK, lineHeight: 1.4 },
  tdMuted: { fontSize: 7.5, color: MUTED, marginTop: 2, letterSpacing: 0.2 },

  // Columns — sum should equal usable width ~523pt
  cSn: { width: 22 },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 50, textAlign: 'right' },
  cRate: { width: 64, textAlign: 'right' },
  cTaxable: { width: 70, textAlign: 'right' },
  cTaxSplit: { width: 60, textAlign: 'right' },
  cTotal: { width: 78, textAlign: 'right' },
  cTotalBold: { fontFamily: 'Roboto-Bold' },

  // ─── Totals ────────────────────────────────────────────────────
  totalsWrap: {
    flexDirection: 'row',
    marginTop: 2,
  },
  totalsSpacer: { flex: 1 },
  totalsCol: {
    width: 240,
    paddingTop: 4,
  },
  totalsLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 1.5,
  },
  totalsLabel: { fontSize: 9, color: MUTED, letterSpacing: 0.3 },
  totalsValue: { fontSize: 9.5, color: INK },
  totalsRule: {
    height: 0.5,
    backgroundColor: RULE,
    marginVertical: 3,
  },
  grandLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: 4,
    paddingBottom: 4,
    borderTopWidth: 1.5,
    borderTopColor: INK,
  },
  grandLabel: {
    fontSize: 11,
    fontFamily: 'Roboto-Bold',
    color: INK,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  grandValue: {
    fontSize: 17,
    fontFamily: 'Roboto-Bold',
    color: TERRACOTTA_DARK,
    letterSpacing: 0.4,
  },
  paidLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 5,
    paddingBottom: 2,
  },
  paidLabel: { fontSize: 9, color: MUTED, fontStyle: 'italic' },
  paidValue: { fontSize: 9.5, color: MUTED },
  balanceLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: 6,
    paddingBottom: 4,
    paddingHorizontal: 8,
    marginTop: 4,
    marginHorizontal: -8,
    backgroundColor: CREAM,
    borderLeftWidth: 2,
    borderLeftColor: TERRACOTTA,
  },
  balanceLabel: {
    fontSize: 10,
    fontFamily: 'Roboto-Bold',
    color: INK,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  balanceValue: {
    fontSize: 13,
    fontFamily: 'Roboto-Bold',
    color: TERRACOTTA_DARK,
    letterSpacing: 0.3,
  },
  paidStamp: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#0F7A4C',
    borderRadius: 2,
    alignSelf: 'flex-end',
  },
  paidStampText: {
    fontSize: 10,
    fontFamily: 'Roboto-Bold',
    color: '#0F7A4C',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },

  // ─── Amount in words ───────────────────────────────────────────
  wordsRow: {
    marginTop: 8,
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 10,
    borderLeftWidth: 2,
    borderLeftColor: TERRACOTTA,
    backgroundColor: CREAM,
  },
  wordsLabel: {
    fontSize: 7,
    color: TERRACOTTA,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontFamily: 'Roboto-Bold',
  },
  wordsValue: {
    fontSize: 10,
    color: INK,
    fontFamily: 'Roboto',
    marginTop: 2,
    lineHeight: 1.4,
  },

  // ─── Terms & conditions ────────────────────────────────────────
  termsSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: RULE_HAIR,
  },
  termsLabel: {
    fontSize: 7.5,
    color: TERRACOTTA,
    textTransform: 'uppercase',
    letterSpacing: 1.8,
    fontFamily: 'Roboto-Bold',
    marginBottom: 5,
  },
  termsList: { flexDirection: 'column' },
  termsItem: {
    flexDirection: 'row',
    marginBottom: 1.5,
    alignItems: 'flex-start',
  },
  termsNumber: {
    width: 13,
    fontSize: 7.5,
    color: MUTED,
    marginTop: 0.5,
  },
  termsText: {
    flex: 1,
    fontSize: 7.5,
    color: INK_SOFT,
    lineHeight: 1.45,
  },
  termsBody: {
    fontSize: 8,
    color: INK_SOFT,
    lineHeight: 1.5,
  },
  noteRow: {
    flexDirection: 'row',
    marginTop: 8,
    alignItems: 'flex-start',
  },
  noteLabel: {
    fontSize: 7.5,
    fontFamily: 'Roboto-Bold',
    color: MUTED,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginRight: 6,
    marginTop: 1.5,
  },
  noteText: {
    flex: 1,
    fontSize: 8.5,
    color: INK_SOFT,
    lineHeight: 1.5,
    fontFamily: 'Roboto',
  },

  // ─── Footer (payment + signature) ──────────────────────────────
  footer: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 36,
  },
  footerLeft: { flex: 1, paddingRight: 12 },
  footerRight: { width: 220 },
  footerLabel: {
    fontSize: 7.5,
    color: TERRACOTTA,
    textTransform: 'uppercase',
    letterSpacing: 1.8,
    marginBottom: 5,
    fontFamily: 'Roboto-Bold',
  },
  footerLine: { fontSize: 9, color: INK_SOFT, lineHeight: 1.5 },
  footerSubLabel: { color: MUTED, marginRight: 3 },
  footerSection: { marginBottom: 10 },

  signFor: { fontSize: 8.5, color: MUTED, marginBottom: 2 },
  signOrgName: {
    fontFamily: 'Roboto-Bold',
    fontSize: 12,
    color: INK,
    letterSpacing: 0.4,
  },
  signGap: { height: 24 },
  signLineRule: { height: 0.75, backgroundColor: INK, marginBottom: 3 },
  signName: {
    fontSize: 10,
    fontFamily: 'Roboto-Bold',
    color: INK,
  },
  signTitle: {
    fontSize: 8,
    color: MUTED,
    marginTop: 1,
    letterSpacing: 0.4,
  },

  // ─── Bottom band ───────────────────────────────────────────────
  bottomBand: {
    marginTop: 14,
    marginHorizontal: -32,
    paddingHorizontal: 32,
    paddingVertical: 8,
    backgroundColor: CREAM,
    borderTopWidth: 0.5,
    borderTopColor: TERRACOTTA_SOFT,
  },
  thanks: {
    fontFamily: 'Roboto',
    fontSize: 10,
    color: TERRACOTTA_DARK,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  disclaimer: {
    fontFamily: 'Roboto',
    fontSize: 7.5,
    color: MUTED,
    textAlign: 'center',
    marginTop: 2,
  },
});

export type QuotePdfData = {
  doc_type: 'QUOTATION' | 'TAX INVOICE';
  doc_number: string;
  issue_date: string;
  valid_until?: string;
  reverse_charge?: boolean;
  org: {
    name: string;
    logo_url: string | null;
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
  };
  customer: {
    name: string;
    phone: string | null;
    email: string | null;
    gstin: string | null;
    billing_address_line1: string | null;
    billing_address_line2: string | null;
    billing_city: string | null;
    billing_state: string | null;
    billing_pincode: string | null;
  };
  install: {
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
  };
  project_label: string | null;
  place_of_supply: string | null;
  lines: Array<{
    description: string;
    hsn_sac_code: string | null;
    unit: Unit;
    quantity: number;
    rate: number;
    tax_rate_percent: number;
    amount: number;
    tax_amount: number;
    line_total: number;
  }>;
  isIntraState: boolean;
  totals: {
    subtotal: number;
    tax_total: number;
    cgst: number;
    sgst: number;
    igst: number;
    round_off: number;
    total: number;
    /** Sum of payments recorded against this invoice (0 for quotes). */
    amount_paid?: number;
    /** Remaining balance (total - amount_paid). Only rendered when amount_paid > 0. */
    amount_due?: number;
  };
  notes: string | null;
  terms_text: string | null;
};

export function QuotePDF({ data }: { data: QuotePdfData }) {
  const orgAddressLine = [
    data.org.address_line1,
    data.org.address_line2,
    [data.org.city, stateNameOrCode(data.org.state), data.org.pincode]
      .filter(Boolean)
      .join(', '),
  ]
    .filter((l): l is string => Boolean(l && l.length > 0))
    .join('  •  ');

  const orgContactLine = [data.org.phone, data.org.email].filter(Boolean).join('  •  ');

  const customerLines = [
    data.customer.billing_address_line1,
    data.customer.billing_address_line2,
    [
      data.customer.billing_city,
      stateNameOrCode(data.customer.billing_state),
      data.customer.billing_pincode,
    ]
      .filter(Boolean)
      .join(', '),
  ].filter((l): l is string => Boolean(l && l.length > 0));

  const installLines = [
    data.install.address_line1,
    data.install.address_line2,
    [
      data.install.city,
      stateNameOrCode(data.install.state),
      data.install.pincode,
    ]
      .filter(Boolean)
      .join(', '),
  ].filter((l): l is string => Boolean(l && l.length > 0));

  const showCgstSgst = data.isIntraState;
  const halfAmt = (l: { tax_amount: number }) => round2(l.tax_amount / 2);

  const isQuote = data.doc_type === 'QUOTATION';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Top band */}
        <View style={styles.topBand} />

        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.brandLeft}>
            {data.org.logo_url && <Image src={data.org.logo_url} style={styles.logo} />}
            <View>
              <Text style={styles.orgName}>{data.org.name}</Text>
              <Text style={styles.tagline}>Crafted interiors • Delhi NCR</Text>
              {orgAddressLine && <Text style={styles.orgAddress}>{orgAddressLine}</Text>}
              {orgContactLine && <Text style={styles.orgContact}>{orgContactLine}</Text>}
              {data.org.gstin && (
                <Text style={styles.orgGstin}>
                  GSTIN {data.org.gstin}
                  {data.org.pan ? `   PAN ${data.org.pan}` : ''}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.docTypeWrap}>
            <Text style={styles.docType}>{data.doc_type}</Text>
            <Text style={styles.docNumber}>{data.doc_number}</Text>
            <View style={styles.docMetaRow}>
              <View style={styles.docMetaCol}>
                <Text style={styles.docMetaLabel}>Date</Text>
                <Text style={styles.docMetaValue}>{formatDateDMY(data.issue_date)}</Text>
              </View>
              {isQuote && data.valid_until ? (
                <View style={styles.docMetaCol}>
                  <Text style={styles.docMetaLabel}>Valid till</Text>
                  <Text style={styles.docMetaValue}>{formatDateDMY(data.valid_until)}</Text>
                </View>
              ) : (
                data.place_of_supply && (
                  <View style={styles.docMetaCol}>
                    <Text style={styles.docMetaLabel}>Place of supply</Text>
                    <Text style={styles.docMetaValue}>{data.place_of_supply}</Text>
                  </View>
                )
              )}
              {!isQuote && (
                <View style={styles.docMetaCol}>
                  <Text style={styles.docMetaLabel}>Reverse charge</Text>
                  <Text style={styles.docMetaValue}>{data.reverse_charge ? 'Yes' : 'No'}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Bill to / Ship to ─────────────────────────────────── */}
        <View style={styles.partiesRow}>
          <View style={styles.partyCol}>
            <Text style={styles.partyLabel}>Billed to</Text>
            <Text style={styles.partyName}>{data.customer.name}</Text>
            {customerLines.map((line, i) => (
              <Text key={i} style={styles.partyLine}>
                {line}
              </Text>
            ))}
            {(data.customer.phone || data.customer.email) && (
              <Text style={styles.partyMuted}>
                {[data.customer.phone, data.customer.email].filter(Boolean).join('  •  ')}
              </Text>
            )}
            {data.customer.gstin && (
              <Text style={styles.partyMuted}>GSTIN  {data.customer.gstin}</Text>
            )}
          </View>

          <View style={styles.partyCol}>
            <Text style={styles.partyLabel}>
              {isQuote ? 'Work / site address' : 'Shipped to'}
            </Text>
            {/* When no site override, silently repeat the customer's billing
                details so the right column balances the left visually. */}
            {(installLines.length > 0 ? null : (
              <Text style={styles.partyName}>{data.customer.name}</Text>
            ))}
            {(installLines.length > 0 ? installLines : customerLines).map((line, i) => (
              <Text key={i} style={styles.partyLine}>
                {line}
              </Text>
            ))}
            {isQuote && data.place_of_supply && (
              <Text style={styles.partyMuted}>
                Place of supply  {data.place_of_supply}
              </Text>
            )}
          </View>
        </View>

        {/* ── Project ──────────────────────────────────────────── */}
        {data.project_label && (
          <View style={styles.projectRow}>
            <Text style={styles.projectLabel}>Project</Text>
            <Text style={styles.projectValue}>{data.project_label}</Text>
          </View>
        )}

        {/* ── Lines table ──────────────────────────────────────── */}
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.cSn]}>#</Text>
            <Text style={[styles.th, styles.cDesc]}>Item & description</Text>
            <Text style={[styles.th, styles.cQty]}>Qty</Text>
            <Text style={[styles.th, styles.cRate]}>Rate</Text>
            <Text style={[styles.th, styles.cTaxable]}>Taxable</Text>
            {showCgstSgst ? (
              <>
                <Text style={[styles.th, styles.cTaxSplit]}>CGST</Text>
                <Text style={[styles.th, styles.cTaxSplit]}>SGST</Text>
              </>
            ) : (
              <Text
                style={[
                  styles.th,
                  styles.cTaxSplit,
                  { width: styles.cTaxSplit.width * 2 },
                ]}
              >
                IGST
              </Text>
            )}
            <Text style={[styles.th, styles.cTotal]}>Amount</Text>
          </View>

          {data.lines.map((l, i) => {
            const subParts: string[] = [];
            if (l.hsn_sac_code) subParts.push(`HSN/SAC ${l.hsn_sac_code}`);
            if (l.tax_rate_percent > 0) subParts.push(`GST ${l.tax_rate_percent}%`);
            const subline = subParts.join('   •   ');
            return (
              <View key={i} style={styles.row}>
                <Text style={[styles.td, styles.cSn, { color: MUTED }]}>{i + 1}</Text>
                <View style={styles.cDesc}>
                  <Text style={styles.td}>{l.description}</Text>
                  {subline && <Text style={styles.tdMuted}>{subline}</Text>}
                </View>
                <Text style={[styles.td, styles.cQty]}>
                  {formatQty(l.quantity)} {UNIT_LABELS[l.unit]}
                </Text>
                <Text style={[styles.td, styles.cRate]}>{formatINRForPdf(l.rate)}</Text>
                <Text style={[styles.td, styles.cTaxable]}>{formatINRForPdf(l.amount)}</Text>
                {showCgstSgst ? (
                  <>
                    <Text style={[styles.td, styles.cTaxSplit]}>
                      {l.tax_amount > 0 ? formatINRForPdf(halfAmt(l)) : '—'}
                    </Text>
                    <Text style={[styles.td, styles.cTaxSplit]}>
                      {l.tax_amount > 0 ? formatINRForPdf(halfAmt(l)) : '—'}
                    </Text>
                  </>
                ) : (
                  <Text
                    style={[
                      styles.td,
                      styles.cTaxSplit,
                      { width: styles.cTaxSplit.width * 2 },
                    ]}
                  >
                    {l.tax_amount > 0 ? formatINRForPdf(l.tax_amount) : '—'}
                  </Text>
                )}
                <Text style={[styles.td, styles.cTotal, styles.cTotalBold]}>
                  {formatINRForPdf(l.line_total)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ── Totals ─────────────────────────────────────────── */}
        <View style={styles.totalsWrap}>
          <View style={styles.totalsSpacer} />
          <View style={styles.totalsCol}>
            <View style={styles.totalsLine}>
              <Text style={styles.totalsLabel}>Taxable amount</Text>
              <Text style={styles.totalsValue}>{formatINRForPdf(data.totals.subtotal)}</Text>
            </View>
            {showCgstSgst ? (
              <>
                <View style={styles.totalsLine}>
                  <Text style={styles.totalsLabel}>CGST</Text>
                  <Text style={styles.totalsValue}>{formatINRForPdf(data.totals.cgst)}</Text>
                </View>
                <View style={styles.totalsLine}>
                  <Text style={styles.totalsLabel}>SGST</Text>
                  <Text style={styles.totalsValue}>{formatINRForPdf(data.totals.sgst)}</Text>
                </View>
              </>
            ) : (
              <View style={styles.totalsLine}>
                <Text style={styles.totalsLabel}>IGST</Text>
                <Text style={styles.totalsValue}>{formatINRForPdf(data.totals.igst)}</Text>
              </View>
            )}
            {Math.abs(round2(data.totals.round_off)) > 0 && (
              <View style={styles.totalsLine}>
                <Text style={styles.totalsLabel}>Round off</Text>
                <Text style={styles.totalsValue}>{formatINRForPdf(data.totals.round_off)}</Text>
              </View>
            )}
            <View style={styles.totalsRule} />
            <View style={styles.grandLine}>
              <Text style={styles.grandLabel}>Total</Text>
              <Text style={styles.grandValue}>{formatINRForPdf(data.totals.total)}</Text>
            </View>
            {(data.totals.amount_paid ?? 0) > 0 && (
              <>
                <View style={styles.paidLine}>
                  <Text style={styles.paidLabel}>Less: amount paid</Text>
                  <Text style={styles.paidValue}>
                    − {formatINRForPdf(data.totals.amount_paid!)}
                  </Text>
                </View>
                {(data.totals.amount_due ?? 0) > 0.005 ? (
                  <View style={styles.balanceLine}>
                    <Text style={styles.balanceLabel}>Balance due</Text>
                    <Text style={styles.balanceValue}>
                      {formatINRForPdf(data.totals.amount_due!)}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.paidStamp}>
                    <Text style={styles.paidStampText}>Paid in full</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* ── Amount in words ───────────────────────────────────── */}
        <View style={styles.wordsRow}>
          <Text style={styles.wordsLabel}>Amount in words</Text>
          <Text style={styles.wordsValue}>{amountInIndianWords(data.totals.total)}</Text>
        </View>

        {/* ── Terms & conditions ────────────────────────────────── */}
        <View style={styles.termsSection}>
          <Text style={styles.termsLabel}>Terms & conditions</Text>
          {data.terms_text ? (
            <Text style={styles.termsBody}>{data.terms_text}</Text>
          ) : (
            <View style={styles.termsList}>
              {(isQuote ? DEFAULT_QUOTE_TERMS : DEFAULT_INVOICE_TERMS).map((t, i) => (
                <View key={i} style={styles.termsItem}>
                  <Text style={styles.termsNumber}>{i + 1}.</Text>
                  <Text style={styles.termsText}>{t}</Text>
                </View>
              ))}
            </View>
          )}
          {data.notes && (
            <View style={styles.noteRow}>
              <Text style={styles.noteLabel}>Note</Text>
              <Text style={styles.noteText}>{data.notes}</Text>
            </View>
          )}
        </View>

        {/* ── Footer (payment + signature) ──────────────────────── */}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            {(data.org.bank_account_name ||
              data.org.bank_name ||
              data.org.bank_account_number ||
              data.org.bank_ifsc ||
              data.org.upi_id) && (
              <View style={styles.footerSection}>
                <Text style={styles.footerLabel}>Payment details</Text>
                {data.org.bank_account_name && (
                  <Text style={styles.footerLine}>{data.org.bank_account_name}</Text>
                )}
                {data.org.bank_name && (
                  <Text style={styles.footerLine}>
                    <Text style={styles.footerSubLabel}>Bank</Text> {data.org.bank_name}
                  </Text>
                )}
                {data.org.bank_account_number && (
                  <Text style={styles.footerLine}>
                    <Text style={styles.footerSubLabel}>A/c</Text> {data.org.bank_account_number}
                  </Text>
                )}
                {data.org.bank_ifsc && (
                  <Text style={styles.footerLine}>
                    <Text style={styles.footerSubLabel}>IFSC</Text> {data.org.bank_ifsc}
                  </Text>
                )}
                {data.org.upi_id && (
                  <Text style={[styles.footerLine, { marginTop: 4 }]}>
                    <Text style={styles.footerSubLabel}>UPI</Text> {data.org.upi_id}
                  </Text>
                )}
              </View>
            )}

          </View>

          <View style={styles.footerRight}>
            <Text style={styles.signFor}>For</Text>
            <Text style={styles.signOrgName}>{data.org.name}</Text>
            <View style={styles.signGap} />
            <View style={styles.signLineRule} />
            <Text style={styles.signName}>
              {data.org.signatory_name ?? 'Authorised Signatory'}
            </Text>
            <Text style={styles.signTitle}>Authorised Signatory</Text>
          </View>
        </View>

        {/* ── Bottom band ───────────────────────────────────────── */}
        <View style={styles.bottomBand}>
          <Text style={styles.thanks}>
            {isQuote
              ? `Thank you for considering ${data.org.name}.`
              : `Thank you for your business — ${data.org.name}.`}
          </Text>
          <Text style={styles.disclaimer}>
            This is a computer-generated {data.doc_type.toLowerCase()} and does not require a
            physical signature.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

function formatQty(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toFixed(3)));
}

function stateNameOrCode(code: string | null | undefined): string {
  if (!code) return '';
  return STATE_BY_CODE[code]?.name ?? code;
}
