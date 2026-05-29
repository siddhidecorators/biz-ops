'use client';

import { useState } from 'react';
import { MessageCircleIcon, LinkIcon, CheckIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { formatINR } from '@/lib/format';

function shareLink(token: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/i/${token}`;
}

function waNumber(phone: string | null): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = '91' + digits;
  return digits.length >= 11 ? digits : null;
}

export function RemindPaymentButton({
  shareToken,
  customerPhone,
  customerName,
  invoiceNumber,
  amountDue,
  orgName,
}: {
  shareToken: string;
  customerPhone: string | null;
  customerName: string | null;
  invoiceNumber: string;
  amountDue: number;
  orgName: string;
}) {
  const [copied, setCopied] = useState(false);

  function handleWhatsApp() {
    const link = shareLink(shareToken);
    const hi = customerName ? `Hi ${customerName}, ` : 'Hi, ';
    const msg = `${hi}a gentle reminder for invoice ${invoiceNumber} from ${orgName} — ${formatINR(
      amountDue,
    )} is due. You can view it and pay here: ${link}`;
    const num = waNumber(customerPhone);
    const url = num
      ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareLink(shareToken));
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — long-press the link to copy it manually.');
    }
  }

  return (
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <Button
        type="button"
        size="lg"
        className="h-12 w-full bg-[#25D366] text-white hover:bg-[#25D366]/90"
        onClick={handleWhatsApp}
      >
        <MessageCircleIcon className="size-4" />
        Send reminder on WhatsApp
      </Button>
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="h-12"
        aria-label="Copy invoice link"
        onClick={handleCopy}
      >
        {copied ? <CheckIcon className="size-4" /> : <LinkIcon className="size-4" />}
      </Button>
    </div>
  );
}
