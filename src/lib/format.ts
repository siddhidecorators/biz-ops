const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const INR_PLAIN = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export function formatINR(amount: number | string | null | undefined): string {
  if (amount == null || amount === '') return '—';
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return '—';
  return INR.format(n);
}

export function formatINRPlain(amount: number | string | null | undefined): string {
  if (amount == null || amount === '') return '';
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return '';
  return INR_PLAIN.format(n);
}

/**
 * Format an amount with the ₹ symbol for PDF output. The PDF now embeds Roboto
 * (see quote-pdf.tsx), which includes the U+20B9 ₹ glyph, so we can use the real
 * symbol instead of the old "Rs" fallback.
 */
export function formatINRForPdf(amount: number | string | null | undefined): string {
  if (amount == null || amount === '') return '—';
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  return `${sign}₹${INR_PLAIN.format(Math.abs(n))}`;
}

export function formatDateDMY(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function isoDate(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date | string, days: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function currentFY(today: Date = new Date()): string {
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  const startYear = month >= 4 ? year : year - 1;
  const endYY = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYY}`;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function roundOffToRupee(total: number): { rounded: number; diff: number } {
  const rounded = Math.round(total);
  return { rounded, diff: round2(rounded - total) };
}

// ─── Indian-English number-to-words (for tax invoice "Amount in words") ──
// Uses the lakh/crore numbering convention. Handles up to 99 crore which
// covers anything Pankaj will plausibly invoice.
const ONES_WORDS = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS_WORDS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function twoDigitWords(n: number): string {
  if (n < 20) return ONES_WORDS[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS_WORDS[t]} ${ONES_WORDS[o]}` : TENS_WORDS[t];
}

function threeDigitWords(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (!h) return twoDigitWords(rest);
  if (!rest) return `${ONES_WORDS[h]} Hundred`;
  return `${ONES_WORDS[h]} Hundred ${twoDigitWords(rest)}`;
}

export function amountInIndianWords(amount: number | string | null | undefined): string {
  if (amount == null || amount === '') return '';
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return '';
  if (n === 0) return 'Zero Rupees only';

  const negative = n < 0;
  const absN = Math.abs(n);
  const rupees = Math.floor(absN);
  const paise = Math.round((absN - rupees) * 100);

  let num = rupees;
  const parts: string[] = [];

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  if (crore) parts.push(`${twoDigitWords(crore)} Crore`);

  const lakh = Math.floor(num / 100000);
  num %= 100000;
  if (lakh) parts.push(`${twoDigitWords(lakh)} Lakh`);

  const thousand = Math.floor(num / 1000);
  num %= 1000;
  if (thousand) parts.push(`${twoDigitWords(thousand)} Thousand`);

  if (num) parts.push(threeDigitWords(num));

  const rupeesWord = parts.length === 0 ? 'Zero' : parts.join(' ');
  const sign = negative ? 'Minus ' : '';

  if (paise > 0) {
    return `${sign}Rupees ${rupeesWord} and ${twoDigitWords(paise)} Paise only`;
  }
  return `${sign}Rupees ${rupeesWord} only`;
}
