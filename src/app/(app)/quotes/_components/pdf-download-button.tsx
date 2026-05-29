'use client';

import { useState } from 'react';
import { DownloadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { QuotePdfData } from './quote-pdf';

// A single, quiet "Download PDF" action. Sharing to the customer happens via
// the WhatsApp link (a viewable page), so the old OS "Share PDF" button was
// redundant and is gone — download is for the owner's own records/printing.
export function PdfDownloadButtons({ data }: { data: QuotePdfData }) {
  const [pending, setPending] = useState(false);

  async function handleDownload() {
    setPending(true);
    try {
      const [{ pdf }, { QuotePDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./quote-pdf'),
      ]);
      const blob = await pdf(<QuotePDF data={data} />).toBlob();
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
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      size="lg"
      variant="outline"
      className="h-11 w-full"
      onClick={handleDownload}
      disabled={pending}
    >
      <DownloadIcon className="size-4" />
      {pending ? 'Building…' : 'Download PDF'}
    </Button>
  );
}
