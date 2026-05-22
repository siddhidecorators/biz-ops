import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PlusIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CRAFT_GROUPS,
  CRAFT_LABELS,
  UNIT_LABELS,
  type Craft,
  type Unit,
} from '@/lib/enums';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AppBar } from '../_components/app-bar';

export const metadata = { title: 'Products' };

type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  craft: Craft;
  unit: Unit;
  hsn_sac_code: string | null;
  default_rate: number | string | null;
  tax_rate_percent: number | string | null;
  verified: boolean;
  is_active: boolean;
};

const ALL_CHAPTERS = Object.keys(CRAFT_GROUPS) as Array<keyof typeof CRAFT_GROUPS>;

// Chapter dot colors — used on each product row as a quick visual cue
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

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { show = 'active' } = await searchParams;
  const showAll = show === 'all';

  let query = supabase
    .from('product_templates')
    .select(
      'id, name, brand, craft, unit, hsn_sac_code, default_rate, tax_rate_percent, verified, is_active',
    )
    .order('name', { ascending: true });

  if (!showAll) query = query.eq('is_active', true);

  const { data: products, error } = await query.returns<ProductRow[]>();

  // Bucket by chapter using CRAFT_GROUPS
  const buckets = new Map<string, ProductRow[]>();
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
          <Link
            href="/products"
            className={cn(
              'rounded-full px-3 py-1 ring-1 transition-colors',
              !showAll
                ? 'bg-primary text-primary-foreground ring-primary'
                : 'bg-card text-muted-foreground ring-border hover:bg-muted',
            )}
          >
            Active
          </Link>
          <Link
            href="/products?show=all"
            className={cn(
              'rounded-full px-3 py-1 ring-1 transition-colors',
              showAll
                ? 'bg-primary text-primary-foreground ring-primary'
                : 'bg-card text-muted-foreground ring-border hover:bg-muted',
            )}
          >
            All (incl. inactive)
          </Link>
        </div>

        {error ? (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error.message}
          </p>
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
  product: ProductRow;
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
