-- Fix RLS recursion: admin policies on profiles table were querying profiles
-- to check is_admin, causing infinite recursion.
-- Solution: use a SECURITY DEFINER function that bypasses RLS.

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Drop the recursive admin policies
DROP POLICY IF EXISTS "Admins read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins update all profiles" ON profiles;

-- Re-create admin policies using the safe function
CREATE POLICY "Admins read all profiles" ON profiles FOR SELECT
  USING (auth.uid() = id OR is_admin());

CREATE POLICY "Admins update all profiles" ON profiles FOR UPDATE
  USING (is_admin());

-- Fix courses admin policy too
DROP POLICY IF EXISTS "Admins manage courses" ON courses;
CREATE POLICY "Admins manage courses" ON courses FOR ALL
  USING (is_admin());

-- Fix security events policy
DROP POLICY IF EXISTS "Admins read security events" ON security_events;
CREATE POLICY "Admins read security events" ON security_events FOR SELECT
  USING (is_admin());
