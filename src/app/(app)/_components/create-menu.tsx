'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import {
  PlusIcon,
  FileTextIcon,
  ReceiptIcon,
  UsersIcon,
  UserPlusIcon,
  PackageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type CreateAction = {
  href: string;
  label: string;
  sub: string;
  Icon: typeof PlusIcon;
  primary?: boolean;
};

// Single entry point for every new record. A quote is the start of the money
// flow (so it's primary), but invoices can also be billed directly via
// /invoices/new without a quote first.
const ACTIONS: CreateAction[] = [
  {
    href: '/quotes/new',
    label: 'New quote',
    sub: 'Start a quote you can turn into a bill',
    Icon: FileTextIcon,
    primary: true,
  },
  {
    href: '/invoices/new',
    label: 'New invoice',
    sub: 'Bill a customer directly',
    Icon: ReceiptIcon,
  },
  {
    href: '/customers/new',
    label: 'New customer',
    sub: 'Add someone to bill',
    Icon: UsersIcon,
  },
  {
    href: '/leads/new',
    label: 'New lead',
    sub: 'Log an enquiry to follow up',
    Icon: UserPlusIcon,
  },
  {
    href: '/products/new',
    label: 'New product or service',
    sub: 'Add to your catalogue',
    Icon: PackageIcon,
  },
];

export function CreateMenu() {
  const [open, setOpen] = useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        aria-label="Create new"
        className="grid size-14 -translate-y-5 place-items-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-lg transition-transform outline-none focus-visible:ring-4 focus-visible:ring-ring/50 active:scale-95"
      >
        <PlusIcon className="size-6" />
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-foreground/30 duration-200 supports-backdrop-filter:backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md rounded-t-3xl bg-popover p-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl ring-1 ring-foreground/10 duration-200 outline-none data-open:animate-in data-open:slide-in-from-bottom-6 data-closed:animate-out data-closed:slide-out-to-bottom-6">
          <div aria-hidden className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" />
          <DialogPrimitive.Title className="text-overline px-2 pb-2">
            Create
          </DialogPrimitive.Title>
          <div className="space-y-2">
            {ACTIONS.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-2xl p-3 ring-1 transition-transform active:scale-[0.99]',
                  a.primary
                    ? 'bg-primary text-primary-foreground shadow-sm ring-transparent'
                    : 'bg-card ring-border hover:bg-muted',
                )}
              >
                <span
                  className={cn(
                    'grid size-11 shrink-0 place-items-center rounded-full',
                    a.primary
                      ? 'bg-white/15 text-primary-foreground'
                      : 'bg-brand-tint text-primary',
                  )}
                >
                  <a.Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{a.label}</span>
                  <span
                    className={cn(
                      'block text-xs',
                      a.primary
                        ? 'text-primary-foreground/85'
                        : 'text-muted-foreground',
                    )}
                  >
                    {a.sub}
                  </span>
                </span>
              </Link>
            ))}
          </div>
          <DialogPrimitive.Close className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-muted-foreground transition-colors hover:bg-muted">
            Cancel
          </DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
