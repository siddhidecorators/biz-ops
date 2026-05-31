'use client';

import { useState } from 'react';
import { Share2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { QuotePdfData } from './quote-pdf';

type WebShareData = { files?: File[]; text?: string; title?: string };

// One "Share" action: builds the actual PDF and hands it to the OS share sheet
// (WhatsApp / Mail / anything) with the message + view-link as the caption.
// Falls back to a text/link share, then to copying the link, where the Web
// Share API (or file sharing) isn't available — e.g. most desktop browsers.
export function ShareButton({
  data,
  token,
  kind,
  message,
  label = 'Share',
  fileName,
}: {
  data: QuotePdfData;
  token: string;
  kind: 'q' | 'i';
  message: string;
  label?: string;
  fileName: string;
}) {
  const [pending, setPending] = useState(false);

  async function handleShare() {
    if (pending) return;
    setPending(true);

    const link =
      typeof window !== 'undefined' ? `${window.location.origin}/${kind}/${token}` : '';
    const text = link ? `${message} ${link}` : message;
    const nav = navigator as Navigator & {
      canShare?: (d?: WebShareData) => boolean;
      share?: (d?: WebShareData) => Promise<void>;
    };

    try {
      const [{ pdf }, { QuotePDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./quote-pdf'),
      ]);
      const blob = await pdf(<QuotePDF data={data} />).toBlob();
      const file = new File([blob], fileName, { type: 'application/pdf' });

      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], text, title: fileName });
      } else if (nav.share) {
        await nav.share({ text, title: fileName });
      } else {
        await navigator.clipboard.writeText(link);
        toast.success('Link copied — paste it into WhatsApp or email');
      }
    } catch (err) {
      // Dismissing the share sheet throws AbortError — not an error.
      if ((err as Error)?.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(link);
          toast.success('Link copied — paste it into WhatsApp or email');
        } catch {
          toast.error('Could not share — use Download PDF instead.');
        }
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      size="lg"
      className="h-12 w-full"
      onClick={handleShare}
      disabled={pending}
    >
      <Share2Icon className="size-4" />
      {pending ? 'Preparing PDF…' : label}
    </Button>
  );
}
