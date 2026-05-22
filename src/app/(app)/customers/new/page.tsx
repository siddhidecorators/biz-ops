import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CustomerForm } from '../_components/customer-form';
import { createCustomer } from '../actions';
import { AppBar } from '../../_components/app-bar';
import { DEFAULT_CUSTOMER_STATE } from '@/lib/india';

export const metadata = { title: 'Add customer' };

export default async function NewCustomerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  return (
    <>
      <AppBar title="Add customer" back={{ href: '/customers' }} />
      <main className="mx-auto max-w-2xl px-6 py-5">
        <CustomerForm
          action={createCustomer}
          defaults={{ billing_state: DEFAULT_CUSTOMER_STATE }}
          submitLabel="Save customer"
        />
      </main>
    </>
  );
}
