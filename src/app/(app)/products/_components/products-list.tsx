'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatINR } from '@/lib/format';
import {
  CRAFT_GROUPS,
  CRAFT_LABELS,
  UNIT_LABELS,
  type Craft,
} from '@/lib/enums';
import {
  productKeys,
  fetchProductsList,
  type ProductListRow,
} from '@/lib/queries/products';
import { AppBar } from '../../_components/app-bar';

const ALL_CHAPTERS = Object.keys(CRAFT_GROUPS) as Array<keyof typeof CRAFT_GROUPS>;

// Chapter dot colors — used as a quick visual cue on each row.
const CHAPTER_DOT: Record<string, string> = {
  Walls: 'bg-amber-500',
  Floors: 'bg-stone-500',
  Windows: 'bg-sky-500',
  Ceilings: 'bg-violet-500',
  Outdoor: 'bg-emerald-500',
  Services: 'bg-slate-500',
};

function chapterOf(craft: Craft): keyof typeof CRAFT_GROUPS {
  for (const chapter of ALL_CHAPTERS) {
    if ((CRAFT_GROUPS[chapter] as readonly Craft[]).includes(craft)) return chapter;
  }
  return ALL_CHAPTERS[0];
}

export function ProductsList({ initialShowAll }: { initialShowAll: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showAll, setShowAll] = useState(initialShowAll);

  // Mirror the toggle into the URL so refresh/share keep state.
  useEffect(() => {
    const current = searchParams.get('show') === 'all';
    if (current === showAll) return;
    const next = new URLSearchParams(searchParams.toString());
    if (showAll) next.set('show', 'all');
    else next.delete('show');
    const qs = next.toString();
    router.replace(qs ? `/products?${qs}` : '/products', { scroll: false });
  }, [showAll, router, searchParams]);

  const {
    data: products,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: productKeys.list({ showAll }),
    queryFn: () => fetchProductsList({ showAll }),
    placeholderData: (prev) => prev,
  });

  // Bucket by chapter using CRAFT_GROUPS
  const buckets = new Map<string, ProductListRow[]>();
  if (products) {
    for (const chapter of ALL_CHAPTERS) buckets.set(chapter, []);
    for (const p of products) buckets.get(chapterOf(p.craft))!.push(p);
  }

  const totalCount = products?.length ?? 0;
  const unverifiedCount = products?.filter((p) => !p.verified).length ?? 0;

  const subtitleParts: string[] = [];
  if (totalCount > 0) subtitleParts.push(`${totalCount} ${showAll ? 'total' : 'active'}`);
  if (unverifiedCount > 0) subtitleParts.push(`${unverifiedCount} unverified`);

  return (
    <>
      <AppBar
        title="Products"
        subtitle={subtitleParts.length > 0 ? subtitleParts.join(' · ') : undefined}
        right={
          <Link
            href="/products/new"
            aria-label="Add product template"
            className="inline-flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 active:opacity-90"
          >
            <PlusIcon className="size-5" />
          </Link>
        }
      />

      <main className="mx-auto max-w-md px-6 py-5">
        <div className="mb-5 flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className={cn(
              'rounded-full px-3 py-1 ring-1 transition-colors',
              !showAll
                ? 'bg-primary text-primary-foreground ring-primary'
                : 'bg-card text-muted-foreground ring-border hover:bg-muted',
            )}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className={cn(
              'rounded-full px-3 py-1 ring-1 transition-colors',
              showAll
                ? 'bg-primary text-primary-foreground ring-primary'
                : 'bg-card text-muted-foreground ring-border hover:bg-muted',
            )}
          >
            All (incl. inactive)
          </button>
        </div>

        {isError ? (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error instanceof Error ? error.message : 'Something went wrong.'}
          </p>
        ) : isPending ? (
          <ProductsSkeleton />
        ) : totalCount === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-5">
            {ALL_CHAPTERS.map((chapter) => {
              const items = buckets.get(chapter) ?? [];
              if (items.length === 0) return null;
              const dotColor = CHAPTER_DOT[chapter] ?? 'bg-muted-foreground';
              return (
                <Card key={chapter}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                      <span
                        aria-hidden
                        className={cn('inline-block size-2 rounded-full', dotColor)}
                      />
                      {chapter}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-0">
                    <ul className="divide-y divide-border">
                      {items.map((p) => (
                        <ProductRowItem key={p.id} product={p} dotColor={dotColor} />
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

function ProductsSkeleton() {
  return (
    <div aria-hidden className="space-y-5">
      {Array.from({ length: 2 }).map((_, ci) => (
        <Card key={ci}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="size-2 animate-pulse rounded-full bg-muted" />
              <span className="h-3 w-20 animate-pulse rounded bg-muted" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y divide-border">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3">
                  <span className="mt-1 size-2 shrink-0 self-start animate-pulse rounded-full bg-muted" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
      <p className="text-base font-medium">No templates yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Templates are reusable line items — brand, craft, HSN code, GST rate.
      </p>
      <Link
        href="/products/new"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
      >
        Add your first template
      </Link>
    </div>
  );
}

function ProductRowItem({
  product: p,
  dotColor,
}: {
  product: ProductListRow;
  dotColor: string;
}) {
  return (
    <li>
      <Link
        href={`/products/${p.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-muted active:bg-muted"
      >
        <span
          aria-hidden
          className={cn('mt-1 inline-block size-2 shrink-0 self-start rounded-full', dotColor)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-base font-medium leading-tight">{p.name}</p>
            {p.verified ? (
              <span className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-300">
                ✓ Verified
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-300">
                Unverified
              </span>
            )}
            {!p.is_active && (
              <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border">
                Inactive
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {CRAFT_LABELS[p.craft]} · per {UNIT_LABELS[p.unit]}
            {p.default_rate != null && ` · ${formatINR(p.default_rate)}`}
            {p.tax_rate_percent != null && ` · GST ${Number(p.tax_rate_percent)}%`}
            {p.brand && ` · ${p.brand}`}
          </p>
        </div>
        <span aria-hidden className="text-muted-foreground">
          ›
        </span>
      </Link>
    </li>
  );
}
