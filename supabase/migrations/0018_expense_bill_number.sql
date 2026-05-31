-- =====================================================================
-- SmallBiz Ops - 0018 expense bill / purchase-invoice number
-- 2026-05-31
--
-- Records the SUPPLIER's invoice/bill number on an expense (the document you
-- received when you bought materials), so purchases can be tracked/reconciled.
-- This is distinct from expenses.invoice_id, which links the cost to one of
-- YOUR OWN sales invoices for profit-per-project.
-- =====================================================================

alter table public.expenses add column if not exists bill_number text;

-- =====================================================================
-- end of migration 0018_expense_bill_number
-- =====================================================================
