-- Simplify the role system to only "Super Admin" | "Viewer".
--
-- 1. Migrate existing Admin / Office Staff users to Viewer.
-- 2. Drop any CHECK constraint on profiles.role that allows the old roles.
-- 3. Add a new CHECK constraint that only allows "Super Admin" and "Viewer".
--
-- NOTE: This migration is non-destructive.  No rows are deleted.  Users whose
-- role was "Admin" or "Office Staff" are moved to "Viewer".  Super Admins and
-- Viewers are untouched.

-- ── 1. Data migration ───────────────────────────────────────────────────────
UPDATE profiles
SET    role = 'Viewer'
WHERE  role IN ('Admin', 'Office Staff');

-- ── 2. Drop the existing CHECK constraint (if any) ──────────────────────────
--    IF EXISTS is a no-op when the constraint is already absent.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- ── 3. Add the new CHECK constraint ─────────────────────────────────────────
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('Super Admin', 'Viewer'));

-- ── 4. Reload PostgREST schema cache ────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
