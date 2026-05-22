'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HomeIcon, UsersIcon, PackageIcon, FileTextIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = {
  href: string;
  label: string;
  Icon: typeof HomeIcon;
  match: (path: string) => boolean;
  disabled?: boolean;
};

const TABS: Tab[] = [
  {
    href: '/',
    label: 'Home',
    Icon: HomeIcon,
    match: (p) => p === '/',
  },
  {
    href: '/customers',
    label: 'Customers',
    Icon: UsersIcon,
    match: (p) => p === '/customers' || p.startsWith('/customers/'),
  },
  {
    href: '/products',
    label: 'Products',
    Icon: PackageIcon,
    match: (p) => p === '/products' || p.startsWith('/products/'),
  },
  {
    href: '/quotes',
    label: 'Quotes',
    Icon: FileTextIcon,
    match: (p) => p === '/quotes' || p.startsWith('/quotes/'),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Content = (
            <span
              className={cn(
                'relative flex flex-col items-center gap-1 px-3 py-2 text-[11px]',
                tab.disabled
                  ? 'text-muted-foreground/50'
                  : active
                    ? 'text-primary'
                    : 'text-muted-foreground',
              )}
            >
              <tab.Icon className={cn('size-5', active && !tab.disabled && 'stroke-[2.5]')} />
              <span className="leading-none">{tab.label}</span>
              {tab.disabled && (
                <span className="-mt-0.5 text-[9px] uppercase tracking-wide">soon</span>
              )}
            </span>
          );

          return (
            <li key={tab.href} className="flex flex-1">
              {tab.disabled ? (
                <span
                  aria-disabled="true"
                  className="flex flex-1 items-center justify-center"
                >
                  {Content}
                </span>
              ) : (
                <Link
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className="flex flex-1 items-center justify-center active:bg-muted"
                >
                  {Content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      <div aria-hidden className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
