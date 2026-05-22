import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProductForm, type ProductDefaults } from '../_components/product-form';
import { DeleteProductButton } from '../_components/delete-button';
import { updateProduct } from '../actions';
import { CRAFT_LABELS, type Craft, type Unit } from '@/lib/enums';
import { AppBar } from '../../_components/app-bar';

export const metadata = { title: 'Edit product' };

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
  notes: string | null;
};

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: product } = await supabase
    .from('product_templates')
    .select(
      'id, name, brand, craft, unit, hsn_sac_code, default_rate, tax_rate_percent, verified, is_active, notes',
    )
    .eq('id', id)
    .maybeSingle<ProductRow>();

  if (!product) notFound();

  const defaults: ProductDefaults = {
    name: product.name,
    brand: product.brand ?? '',
    craft: product.craft,
    unit: product.unit,
    hsn_sac_code: product.hsn_sac_code ?? '',
    default_rate: product.default_rate != null ? String(product.default_rate) : '',
    tax_rate_percent:
      product.tax_rate_percent != null ? String(product.tax_rate_percent) : '',
    verified: product.verified,
    is_active: product.is_active,
    notes: product.notes ?? '',
  };

  const action = updateProduct.bind(null, product.id);

  return (
    <>
      <AppBar
        title={product.name}
        subtitle={CRAFT_LABELS[product.craft]}
        back={{ href: '/products' }}
      />
      <main className="mx-auto max-w-2xl px-6 py-5">
        <ProductForm
          action={action}
          defaults={defaults}
          submitLabel="Save changes"
          showActiveToggle
        />

        <div className="mt-8 border-t border-border pt-6">
          <DeleteProductButton productId={product.id} productName={product.name} />
        </div>
      </main>
    </>
  );
}
