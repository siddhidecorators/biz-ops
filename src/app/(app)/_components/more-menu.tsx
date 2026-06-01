'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import {
  MoreHorizontalIcon,
  UsersIcon,
  PackageIcon,
  UserPlusIcon,
  WalletIcon,
  BarChart3Icon,
  SettingsIcon,
  ChevronRightIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type MoreItem = {
  href: string;
  label: string;
  sub: string;
  Icon: typeof UsersIcon;
  tone: 'brand' | 'info' | 'warning' | 'success' | 'neutral';
  match: (p: string) => boolean;
};

// Everything secondary lives here, reachable from every screen (vs. the old
// Home-only "Manage" grid). The center ＋ is for creating; these tabs are for
// finding. Customers sits here too now that the money pipeline (Quotes/Invoices)
// owns the bottom nav.
const ITEMS: MoreItem[] = [
  {
    href: '/customers',
    label: 'Customers',
    sub: 'People you bill',
    Icon: UsersIcon,
    tone: 'brand',
    match: (p) => p === '/customers' || p.startsWith('/customers/'),
  },
  {
    href: '/products',
    label: 'Products & services',
    sub: 'Your catalogue & pricing',
    Icon: PackageIcon,
    tone: 'brand',
    match: (p) => p === '/products' || p.startsWith('/products/'),
  },
  {
    href: '/leads',
    label: 'Leads',
    sub: 'Enquiries & follow-ups',
    Icon: UserPlusIcon,
    tone: 'info',
    match: (p) => p === '/leads' || p.startsWith('/leads/'),
  },
  {
    href: '/expenses',
    label: 'Expenses',
    sub: 'Costs & profit per job',
    Icon: WalletIcon,
    tone: 'warning',
    match: (p) => p === '/expenses' || p.startsWith('/expenses/'),
  },
  {
    href: '/reports',
    label: 'Reports',
    sub: 'GST, sales & who owes you',
    Icon: BarChart3Icon,
    tone: 'success',
    match: (p) => p === '/reports',
  },
  {
    href: '/settings',
    label: 'Settings',
    sub: 'Business details & team',
    Icon: SettingsIcon,
    tone: 'neutral',
    match: (p) => p === '/settings' || p.startsWith('/settings/'),
  },
];

const CHIP: Record<MoreItem['tone'], string> = {
  brand: 'bg-brand-tint text-primary',
  info: 'bg-info-tint text-info-strong',
  warning: 'bg-warning-tint text-warning-strong',
  success: 'bg-success-tint text-success-strong',
  neutral: 'bg-muted text-muted-foreground',
};

// True when the current route is one of the secondary sections, so the More tab
// highlights like a normal tab.
export function isMorePath(p: string): boolean {
  return ITEMS.some((i) => i.match(p));
}

export function MoreMenu({ active }: { active: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        aria-label="More"
        className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5 outline-none transition-colors active:bg-muted/60"
      >
        <MoreHorizontalIcon
          className={cn(
            'size-5 transition-colors',
            active ? 'stroke-[2.4] text-primary' : 'text-muted-foreground',
          )}
        />
        <span
          className={cn(
            'text-[11px] leading-none',
            active ? 'font-semibold text-primary' : 'text-muted-foreground',
          )}
        >
          More
        </span>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-foreground/30 duration-200 supports-backdrop-filter:backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md rounded-t-3xl bg-popover p-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl ring-1 ring-foreground/10 duration-200 outline-none data-open:animate-in data-open:slide-in-from-bottom-6 data-closed:animate-out data-closed:slide-out-to-bottom-6">
          <div aria-hidden className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" />
          <DialogPrimitive.Title className="text-overline px-2 pb-2">
            Go to
          </DialogPrimitive.Title>
          <div className="space-y-1.5">
            {ITEMS.map((it) => {
              const isActive = it.match(pathname);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl p-3 transition-colors',
                    isActive ? 'bg-brand-tint' : 'hover:bg-muted active:bg-muted',
                  )}
                >
                  <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', CHIP[it.tone])}>
                    <it.Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm font-semibold', isActive && 'text-primary')}>
                      {it.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">{it.sub}</span>
                  </span>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
          <DialogPrimitive.Close className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-muted-foreground transition-colors hover:bg-muted">
            Close
          </DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
