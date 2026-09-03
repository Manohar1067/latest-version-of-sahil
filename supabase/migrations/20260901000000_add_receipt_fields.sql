-- Add missing fields from the original hard-copy Goods Despatch Memo.
-- All columns are nullable / default 0 so existing rows remain valid.

ALTER TABLE memos
  ADD COLUMN IF NOT EXISTS gc_no text,
  ADD COLUMN IF NOT EXISTS total_hire numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at text,
  ADD COLUMN IF NOT EXISTS local_driver_guide numeric NOT NULL DEFAULT 0;

ALTER TABLE transport_list
  ADD COLUMN IF NOT EXISTS gc_no text,
  ADD COLUMN IF NOT EXISTS total_hire numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at text,
  ADD COLUMN IF NOT EXISTS local_driver_guide numeric NOT NULL DEFAULT 0;
