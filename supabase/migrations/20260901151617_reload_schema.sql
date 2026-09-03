-- Additive, idempotent migration to bring the remote schema in line with the
-- application's memo/transport data mapping.
--
-- 1. The hard-copy Goods Despatch Memo fields were added by the earlier
--    20260901000000_add_receipt_fields.sql migration. They already exist on
--    memos / transport_list (verified via REST), so the ADD COLUMN IF NOT
--    EXISTS statements below are safe no-ops for them.
--
-- 2. halting_date is referenced by the TransportEntry type / field map but was
--    genuinely absent from transport_list — added here.
--
-- 3. NOTIFY pgrst, 'reload schema' forces PostgREST to rebuild its schema
--    cache. This is the fix for the runtime error:
--      "Could not find the 'gc_no' column of 'memos' in the schema cache"
--    Without this reload, PostgREST keeps a stale column list after DDL and
--    INSERT/UPDATE of the new columns fails even though they exist.
--
-- ADDITIVE ONLY: no DROP, no DELETE, no data reset, no table recreation.

ALTER TABLE public.memos
  ADD COLUMN IF NOT EXISTS gc_no text,
  ADD COLUMN IF NOT EXISTS total_hire numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at text,
  ADD COLUMN IF NOT EXISTS local_driver_guide numeric NOT NULL DEFAULT 0;

ALTER TABLE public.transport_list
  ADD COLUMN IF NOT EXISTS gc_no text,
  ADD COLUMN IF NOT EXISTS total_hire numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at text,
  ADD COLUMN IF NOT EXISTS local_driver_guide numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS halting_date date;

NOTIFY pgrst, 'reload schema';
