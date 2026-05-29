'use client';

import { useState } from 'react';
import { MessageCircleIcon, LinkIcon, CheckIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

function shareLink(token: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/q/${token}`;
}

// Normalise an Indian mobile number to wa.me's "country-code + number" form.
function waNumber(phone: string | null): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = '91' + digits;
  return digits.length >= 11 ? digits : null;
}

export function ShareQuoteButton({
  shareToken,
  customerPhone,
  customerName,
  quoteNumber,
  orgName,
}: {
  shareToken: string;
  customerPhone: string | null;
  customerName: string | null;
  quoteNumber: string;
  orgName: string;
}) {
  const [copied, setCopied] = useState(false);

  function handleWhatsApp() {
    const link = shareLink(shareToken);
    const hi = customerName ? `Hi ${customerName}, ` : 'Hi, ';
    const msg = `${hi}here's your quote ${quoteNumber} from ${orgName}. You can view it and accept it here: ${link}`;
    const num = waNumber(customerPhone);
    const url = num
      ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handleCopy() {
    const link = shareLink(shareToken);
    try {
      await navigator.clipboard.writeText(link);
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
        Send on WhatsApp
      </Button>
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="h-12"
        aria-label="Copy share link"
        onClick={handleCopy}
      >
        {copied ? <CheckIcon className="size-4" /> : <LinkIcon className="size-4" />}
      </Button>
    </div>
  );
}
