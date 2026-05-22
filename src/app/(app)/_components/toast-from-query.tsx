'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { toast } from 'sonner';

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
  payment_recorded: 'Payment recorded',
  payment_deleted: 'Payment removed',
  settings_saved: 'Settings saved',
};

function ToastFromQueryInner({ paramKey = 'saved' }: { paramKey?: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const value = searchParams.get(paramKey);

  useEffect(() => {
    if (!value) return;
    const msg = MESSAGES[value];
    if (msg) toast.success(msg);

    // Strip the param so a refresh doesn't re-fire the toast
    const next = new URLSearchParams(searchParams.toString());
    next.delete(paramKey);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [value, paramKey, pathname, router, searchParams]);

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
