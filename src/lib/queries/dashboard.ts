import { createClient } from '@/lib/supabase/browser';

export type DashboardCounts = {
  customers: number;
  products: number;
  unverified: number;
  open_quotes: number;
  unpaid_invoices: number;
};

export const dashboardKeys = {
  all: ['dashboard'] as const,
  counts: () => [...dashboardKeys.all, 'counts'] as const,
};

type RpcRow = {
  customers: number | string;
  products: number | string;
  unverified: number | string;
  open_quotes: number | string;
  unpaid_invoices: number | string;
};

export async function fetchDashboardCounts(): Promise<DashboardCounts> {
  const supabase = createClient();
  // The Postgres function `RETURNS TABLE(...)` so PostgREST sends back an
  // array of rows. We always get exactly one row.
  const { data, error } = await supabase.rpc('get_dashboard_counts');
  if (error) throw error;
  const rows = (data ?? []) as RpcRow[];
  const row = rows[0];
  return {
    customers: Number(row?.customers ?? 0),
    products: Number(row?.products ?? 0),
    unverified: Number(row?.unverified ?? 0),
    open_quotes: Number(row?.open_quotes ?? 0),
    unpaid_invoices: Number(row?.unpaid_invoices ?? 0),
  };
}
