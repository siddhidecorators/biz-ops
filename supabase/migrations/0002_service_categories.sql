-- =====================================================================
-- SmallBiz Ops — Phase 1.5: service line-item categories
-- 2026-05-22
--
-- The `craft` enum was Phase-1 strict to the 14 decorative crafts. In real
-- ops Pankaj also bills labour, installation, cartage, stitching, repair,
-- and site-visit charges as line items. Each of these has its own SAC code
-- and GST rate, so they get their own templates.
--
-- IMPORTANT: ALTER TYPE ... ADD VALUE cannot run inside a transaction in
-- older Postgres versions. Each statement is its own DDL. The
-- IF NOT EXISTS makes the migration safely re-runnable.
-- =====================================================================

alter type craft add value if not exists 'labour_charge';
alter type craft add value if not exists 'installation_charge';
alter type craft add value if not exists 'cartage_charge';
alter type craft add value if not exists 'stitching_charge';
alter type craft add value if not exists 'repair_charge';
alter type craft add value if not exists 'site_visit_charge';
alter type craft add value if not exists 'polish_charge';
alter type craft add value if not exists 'dismantling_charge';
