'use client';

import { useState } from 'react';
import { DownloadIcon, Share2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { QuotePdfData } from './quote-pdf';

export function PdfDownloadButtons({ data }: { data: QuotePdfData }) {
  const [pending, setPending] = useState<'download' | 'share' | null>(null);

  async function buildBlob(): Promise<Blob> {
    const [{ pdf }, { QuotePDF }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('./quote-pdf'),
    ]);
    return pdf(<QuotePDF data={data} />).toBlob();
  }

  async function handleDownload() {
    setPending('download');
    try {
      const blob = await buildBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.doc_number.replace(/[/\\]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setPending(null);
    }
  }

  async function handleShare() {
    setPending('share');
    try {
      const blob = await buildBlob();
      const file = new File(
        [blob],
        `${data.doc_number.replace(/[/\\]/g, '_')}.pdf`,
        { type: 'application/pdf' },
      );
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      const shareData: ShareData = {
        files: [file],
        title: `${data.doc_type} ${data.doc_number}`,
        text: `${data.doc_type} ${data.doc_number} from ${data.org.name}`,
      };
      if (nav.canShare?.(shareData)) {
        await nav.share(shareData);
      } else {
        // Fall back to downloading — desktop browsers can't share files
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      // User cancelled share, ignore
      if ((e as DOMException)?.name !== 'AbortError') console.error(e);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="h-11 w-full"
        onClick={handleDownload}
        disabled={pending !== null}
      >
        <DownloadIcon className="size-4" />
        {pending === 'download' ? 'Building…' : 'Download PDF'}
      </Button>
      <Button
        type="button"
        size="lg"
        className="h-11 w-full"
        onClick={handleShare}
        disabled={pending !== null}
      >
        <Share2Icon className="size-4" />
        {pending === 'share' ? 'Building…' : 'Share PDF'}
      </Button>
    </div>
  );
}
