import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProductForm } from '../_components/product-form';
import { createProduct } from '../actions';
import { AppBar } from '../../_components/app-bar';

export const metadata = { title: 'Add product' };

export default async function NewProductPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  return (
    <>
      <AppBar title="Add template" back={{ href: '/products' }} />
      <main className="mx-auto max-w-2xl px-6 py-5">
        <ProductForm action={createProduct} submitLabel="Save template" />
      </main>
    </>
  );
}
