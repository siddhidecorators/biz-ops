import Link from 'next/link';
import { ArrowLeftIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AppBar({
  title,
  subtitle,
  back,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: { href: string; label?: string };
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-md items-center gap-2 px-3">
        {back ? (
          <Link
            href={back.href}
            aria-label={back.label ?? 'Back'}
            className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-muted"
          >
            <ArrowLeftIcon className="size-5" />
          </Link>
        ) : (
          <div className="w-10 shrink-0" aria-hidden />
        )}

        <div className={cn('min-w-0 flex-1', back ? '' : 'pl-2')}>
          <h1 className="truncate text-base leading-tight font-medium tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>

        <div className="flex w-10 shrink-0 items-center justify-end">{right}</div>
      </div>
    </header>
  );
}
