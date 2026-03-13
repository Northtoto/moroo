-- SECURITY FIX: Prevent users from self-escalating privilege fields.
--
-- The original "Users update own profile" policy (migration 001) used only
-- USING (auth.uid() = id), which restricts which rows can be targeted but
-- does NOT restrict what column values can be written. Without a WITH CHECK
-- clause a user could execute:
--
--   UPDATE profiles SET is_admin = true WHERE id = auth.uid();
--   UPDATE profiles SET approval_status = 'approved' WHERE id = auth.uid();
--
-- and both would succeed. This migration drops and replaces that policy with
-- one that includes a WITH CHECK clause blocking writes to privilege columns.

DROP POLICY IF EXISTS "Users update own profile" ON profiles;

CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND is_admin = false
    AND approval_status = (SELECT approval_status FROM profiles WHERE id = auth.uid())
  );
