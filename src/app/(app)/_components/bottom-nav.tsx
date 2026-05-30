'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HomeIcon, UsersIcon, FileTextIcon, ReceiptIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreateMenu } from './create-menu';

type Tab = {
  href: string;
  label: string;
  Icon: typeof HomeIcon;
  match: (path: string) => boolean;
};

// Daily-flow tabs. Products is reference data — reached from the Home grid and
// the Create menu — so it's intentionally not a tab; Invoices takes its place.
const LEFT_TABS: Tab[] = [
  { href: '/', label: 'Home', Icon: HomeIcon, match: (p) => p === '/' },
  {
    href: '/customers',
    label: 'Customers',
    Icon: UsersIcon,
    match: (p) => p === '/customers' || p.startsWith('/customers/'),
  },
];

const RIGHT_TABS: Tab[] = [
  {
    href: '/quotes',
    label: 'Quotes',
    Icon: FileTextIcon,
    match: (p) => p === '/quotes' || p.startsWith('/quotes/'),
  },
  {
    href: '/invoices',
    label: 'Invoices',
    Icon: ReceiptIcon,
    match: (p) => p === '/invoices' || p.startsWith('/invoices/'),
  },
];

function TabLink({ tab, active }: { tab: Tab; active: boolean }) {
  return (
    <li className="flex flex-1">
      <Link
        href={tab.href}
        aria-current={active ? 'page' : undefined}
        className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-colors active:bg-muted/60"
      >
        <tab.Icon
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
          {tab.label}
        </span>
      </Link>
    </li>
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75"
    >
      <ul className="mx-auto flex max-w-md items-stretch px-1">
        {LEFT_TABS.map((t) => (
          <TabLink key={t.href} tab={t} active={t.match(pathname)} />
        ))}
        <li className="flex flex-1 items-start justify-center">
          <CreateMenu />
        </li>
        {RIGHT_TABS.map((t) => (
          <TabLink key={t.href} tab={t} active={t.match(pathname)} />
        ))}
      </ul>
      <div aria-hidden className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
