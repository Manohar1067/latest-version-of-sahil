-- Additive migration: track which transport_list fields have been independently
-- overridden when editing via the Transport List edit flow.
--
-- This is ADDITIVE ONLY:
--   - Adds a single jsonb column to transport_list.
--   - Does NOT drop, rename, or alter any existing column/table/function/trigger.
--   - Existing rows are unaffected (the new column defaults to NULL).
--
-- The override model (PART 10):
--   - Default: a transport entry's field inherits the value from the memo/register.
--   - After a Transport List edit, that field is marked overridden here and
--     future memo edits will NOT overwrite it.

ALTER TABLE public.transport_list
  ADD COLUMN IF NOT EXISTS overridden_fields jsonb;
