import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchQuotesList } from '@/lib/queries/quotes';
import { QuotesList } from './_components/quotes-list';

export const metadata = { title: 'Quotes' };

export default async function QuotesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const initialData = await fetchQuotesList(supabase).catch(() => undefined);

  return <QuotesList initialData={initialData} />;
}
