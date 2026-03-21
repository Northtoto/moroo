-- ============================================================
-- Migration 023: Skool Community Access Bridge
-- Adds Skool membership tracking and pre-authorized email
-- allowlist for automatic premium grant at signup.
-- ============================================================

-- 1. Extend profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS skool_member       BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS skool_verified_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signup_source      TEXT        DEFAULT 'web'
    CHECK (signup_source IN ('web', 'skool', 'referral'));

-- 2. Pre-authorized email allowlist (service-role only via RLS)
CREATE TABLE IF NOT EXISTS skool_verified_emails (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL UNIQUE,
  verified_at TIMESTAMPTZ DEFAULT now(),
  granted_by  TEXT        NOT NULL  -- 'zapier' | 'admin' | 'csv_import'
);

CREATE INDEX IF NOT EXISTS idx_skool_emails_lower
  ON skool_verified_emails (lower(email));

ALTER TABLE skool_verified_emails ENABLE ROW LEVEL SECURITY;

-- Service-role only — anon/authenticated roles can never read this table
DROP POLICY IF EXISTS "service_role_only_skool_emails" ON skool_verified_emails;
CREATE POLICY "service_role_only_skool_emails"
  ON skool_verified_emails FOR ALL
  USING (false) WITH CHECK (false);

-- 3. Replace handle_new_user to auto-grant premium for Skool emails
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_cefr      TEXT;
  v_source    TEXT;
  v_is_skool  BOOLEAN := false;
BEGIN
  v_cefr := COALESCE(NULLIF(NEW.raw_user_meta_data->>'cefr_level', ''), 'A1');
  IF v_cefr NOT IN ('A1','A2','B1','B2','C1','C2') THEN v_cefr := 'A1'; END IF;

  v_source := COALESCE(NULLIF(NEW.raw_user_meta_data->>'signup_source', ''), 'web');
  IF v_source NOT IN ('web', 'skool', 'referral') THEN v_source := 'web'; END IF;

  -- Check allowlist (case-insensitive)
  SELECT true INTO v_is_skool
  FROM skool_verified_emails
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  IF v_is_skool THEN v_source := 'skool'; END IF;

  INSERT INTO profiles (id, email, full_name, cefr_level, signup_source,
                        skool_member, skool_verified_at)
  VALUES (
    NEW.id, NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    v_cefr, v_source,
    COALESCE(v_is_skool, false),
    CASE WHEN v_is_skool THEN now() ELSE NULL END
  );

  INSERT INTO learning_state (user_id, cefr_estimate)
  VALUES (NEW.id, v_cefr)
  ON CONFLICT (user_id) DO NOTHING;

  -- Auto-grant premium subscription if email is on Skool allowlist
  IF v_is_skool THEN
    INSERT INTO subscriptions (user_id, tier, status, updated_at)
    VALUES (NEW.id, 'premium', 'active', now())
    ON CONFLICT (user_id) DO UPDATE
      SET tier = 'premium', status = 'active', updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Backfill: upgrade existing users whose email is already in allowlist
-- (safe no-op on first run since table is empty)
UPDATE subscriptions s
SET    tier = 'premium', status = 'active', updated_at = now()
FROM   profiles p
WHERE  p.id = s.user_id
  AND  lower(p.email) IN (SELECT lower(email) FROM skool_verified_emails)
  AND  s.tier != 'premium';

UPDATE profiles
SET    skool_member = true, skool_verified_at = now(),
       signup_source = 'skool', subscription_tier = 'premium'
WHERE  lower(email) IN (SELECT lower(email) FROM skool_verified_emails)
  AND  skool_member = false;
