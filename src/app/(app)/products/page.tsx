import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
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
  return <ProductsList initialShowAll={show === 'all'} />;
}
