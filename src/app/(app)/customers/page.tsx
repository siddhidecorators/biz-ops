import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PlusIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CUSTOMER_TYPE_LABELS, type CustomerType } from '@/lib/enums';
import { AppBar } from '../_components/app-bar';

export const metadata = { title: 'Customers' };

type CustomerListRow = {
  id: string;
  name: string;
  customer_type: CustomerType;
  phone: string;
  billing_city: string | null;
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { q = '' } = await searchParams;
  const rawTerm = q.trim();
  // Limit to characters that are safe inside a PostgREST .or() filter value
  // (letters/digits/space/dot/+/-) and escape ILIKE wildcards.
  const safeTerm = rawTerm.replace(/[^\p{L}\p{N}\s.+\-]/gu, '');
  const escaped = safeTerm.replace(/[%_]/g, (m) => `\\${m}`);

  let query = supabase
    .from('customers')
    .select('id, name, customer_type, phone, billing_city')
    .order('name', { ascending: true })
    .limit(200);

  if (escaped) {
    query = query.or(`name.ilike.%${escaped}%,phone.ilike.%${escaped}%`);
  }

  const { data: customers, error } = await query.returns<CustomerListRow[]>();
  const total = customers?.length ?? 0;

  return (
    <>
      <AppBar
        title="Customers"
        subtitle={total > 0 ? `${total} total` : undefined}
        right={
          <Link
            href="/customers/new"
            aria-label="Add customer"
            className="inline-flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 active:opacity-90"
          >
            <PlusIcon className="size-5" />
          </Link>
        }
      />

      <main className="mx-auto max-w-md px-6 py-5">
        <form method="GET" className="mb-5 space-y-2">
          <Label htmlFor="q" className="sr-only">
            Search
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="q"
              name="q"
              type="search"
              placeholder="Search by name or phone"
              defaultValue={rawTerm}
              inputMode="search"
              enterKeyHint="search"
              className="h-11"
            />
            <Button type="submit" variant="outline" size="lg" className="h-11">
              Search
            </Button>
          </div>
          {rawTerm && (
            <Link
              href="/customers"
              className="inline-block text-xs text-muted-foreground underline underline-offset-2"
            >
              Clear search
            </Link>
          )}
        </form>

        {error ? (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error.message}
          </p>
        ) : total === 0 ? (
          <EmptyState hasSearch={!!rawTerm} />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            {customers!.map((c) => (
              <CustomerRow key={c.id} customer={c} />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  if (hasSearch) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">No customers match your search.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
      <p className="text-base font-medium">No customers yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Add Pankaj&apos;s first customer to start invoicing.
      </p>
      <Link
        href="/customers/new"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
      >
        Add your first customer
      </Link>
    </div>
  );
}

function CustomerRow({ customer: c }: { customer: CustomerListRow }) {
  const initials = initialsFromName(c.name);
  return (
    <li>
      <Link
        href={`/customers/${c.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-muted active:bg-muted"
      >
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-tint text-sm font-medium text-primary"
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium leading-tight">{c.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {CUSTOMER_TYPE_LABELS[c.customer_type]}
            {' · '}
            {c.phone}
            {c.billing_city ? ` · ${c.billing_city}` : ''}
          </p>
        </div>
        <span aria-hidden className="text-muted-foreground">
          ›
        </span>
      </Link>
    </li>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
