import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CustomerForm, type CustomerDefaults } from '../_components/customer-form';
import { DeleteCustomerButton } from '../_components/delete-button';
import { updateCustomer } from '../actions';
import type { CustomerType } from '@/lib/enums';
import { AppBar } from '../../_components/app-bar';

export const metadata = { title: 'Edit customer' };

type CustomerRow = {
  id: string;
  name: string;
  customer_type: CustomerType;
  phone: string;
  alt_phone: string | null;
  email: string | null;
  gstin: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_pincode: string | null;
  notes: string | null;
};

export default async function EditCustomerPage({
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

  const { data: customer } = await supabase
    .from('customers')
    .select(
      'id, name, customer_type, phone, alt_phone, email, gstin, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_pincode, notes',
    )
    .eq('id', id)
    .maybeSingle<CustomerRow>();

  if (!customer) notFound();

  const defaults: CustomerDefaults = {
    name: customer.name,
    customer_type: customer.customer_type,
    phone: customer.phone,
    alt_phone: customer.alt_phone ?? '',
    email: customer.email ?? '',
    gstin: customer.gstin ?? '',
    billing_address_line1: customer.billing_address_line1 ?? '',
    billing_address_line2: customer.billing_address_line2 ?? '',
    billing_city: customer.billing_city ?? '',
    billing_state: customer.billing_state ?? '',
    billing_pincode: customer.billing_pincode ?? '',
    notes: customer.notes ?? '',
  };

  const action = updateCustomer.bind(null, customer.id);

  return (
    <>
      <AppBar
        title={customer.name}
        subtitle="Edit customer"
        back={{ href: '/customers' }}
      />
      <main className="mx-auto max-w-2xl px-6 py-5">
        <CustomerForm action={action} defaults={defaults} submitLabel="Save changes" />

        <div className="mt-8 border-t border-border pt-6">
          <DeleteCustomerButton customerId={customer.id} customerName={customer.name} />
        </div>
      </main>
    </>
  );
}
