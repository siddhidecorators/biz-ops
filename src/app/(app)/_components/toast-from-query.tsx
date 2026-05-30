'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { customerKeys } from '@/lib/queries/customers';
import { productKeys } from '@/lib/queries/products';
import { quoteKeys } from '@/lib/queries/quotes';
import { invoiceKeys } from '@/lib/queries/invoices';
import { leadKeys } from '@/lib/queries/leads';

const MESSAGES: Record<string, string> = {
  customer_created: 'Customer added',
  customer_updated: 'Changes saved',
  customer_deleted: 'Customer deleted',
  product_created: 'Template added',
  product_updated: 'Changes saved',
  product_deleted: 'Template deleted',
  quote_created: 'Quote saved',
  quote_updated: 'Quote updated',
  quote_deleted: 'Quote deleted',
  invoice_created: 'Invoice created',
  lead_created: 'Lead added',
  lead_updated: 'Lead updated',
  lead_deleted: 'Lead deleted',
  settings_saved: 'Settings saved',
};

// Keys to invalidate when a given ?saved=<value> redirect fires. The server
// action's revalidatePath() is moot once data is client-cached — this is what
// keeps the client cache in sync with the server write.
const INVALIDATIONS: Record<string, readonly unknown[][]> = {
  customer_created: [[...customerKeys.lists()]],
  customer_updated: [[...customerKeys.lists()], [...customerKeys.details()]],
  customer_deleted: [[...customerKeys.lists()]],
  product_created: [[...productKeys.lists()]],
  product_updated: [[...productKeys.lists()], [...productKeys.details()]],
  product_deleted: [[...productKeys.lists()]],
  quote_created: [[...quoteKeys.lists()]],
  quote_updated: [[...quoteKeys.lists()], [...quoteKeys.details()]],
  quote_deleted: [[...quoteKeys.lists()]],
  invoice_created: [[...invoiceKeys.lists()]],
  lead_created: [[...leadKeys.lists()]],
  lead_updated: [[...leadKeys.lists()], [...leadKeys.details()]],
  lead_deleted: [[...leadKeys.lists()]],
};

function ToastFromQueryInner({ paramKey = 'saved' }: { paramKey?: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const value = searchParams.get(paramKey);

  useEffect(() => {
    if (!value) return;
    const msg = MESSAGES[value];
    if (msg) toast.success(msg);

    const invalidations = INVALIDATIONS[value];
    if (invalidations) {
      for (const key of invalidations) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    }

    // Strip the param so a refresh doesn't re-fire the toast.
    const next = new URLSearchParams(searchParams.toString());
    next.delete(paramKey);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [value, paramKey, pathname, router, searchParams, queryClient]);

  return null;
}

export function ToastFromQuery(props: { paramKey?: string }) {
  // useSearchParams needs to be inside Suspense in Next 16
  return (
    <Suspense fallback={null}>
      <ToastFromQueryInner {...props} />
    </Suspense>
  );
}
