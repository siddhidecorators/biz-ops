import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchProductsList } from '@/lib/queries/products';
import { ProductsList } from './_components/products-list';

export const metadata = { title: 'Products' };

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

  const { show } = await searchParams;
  const showAll = show === 'all';
  const initialData = await fetchProductsList({ showAll }, supabase).catch(() => undefined);
  return <ProductsList initialShowAll={showAll} initialData={initialData} />;
}
