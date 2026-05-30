import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isoDate, currentFY } from '@/lib/format';
import { ReportsView } from './_components/reports-view';

export const metadata = { title: 'Reports' };

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  // Compute the period anchors on the server so the client view renders the
  // same defaults on hydration (no timezone-dependent mismatch).
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1; // 1–12
  const fyStartYear = m >= 4 ? y : y - 1;
  const fyStart = `${fyStartYear}-04-01`;
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
  const today = isoDate();

  return (
    <ReportsView
      today={today}
      fyStart={fyStart}
      monthStart={monthStart}
      fyLabel={currentFY()}
    />
  );
}
