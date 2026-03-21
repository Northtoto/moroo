-- Migration 022: Capture CEFR level from signup metadata
-- Adds cefr_level to profiles and pre-seeds learning_state on user creation.

-- 1. Add cefr_level column to profiles (defaults to A1 if not provided)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cefr_level TEXT DEFAULT 'A1'
  CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2'));

-- 2. Update handle_new_user trigger to capture cefr_level from signup metadata
--    and pre-seed the learning_state row so /progress never shows empty state.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_cefr TEXT;
BEGIN
  -- Read cefr_level from user metadata (sent by signup form), fallback to A1
  v_cefr := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'cefr_level', ''),
    'A1'
  );
  -- Clamp to valid values
  IF v_cefr NOT IN ('A1','A2','B1','B2','C1','C2') THEN
    v_cefr := 'A1';
  END IF;

  -- Create profile row
  INSERT INTO profiles (id, email, full_name, cefr_level)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    v_cefr
  );

  -- Pre-seed learning_state so the tutor can personalise from day one
  INSERT INTO learning_state (user_id, cefr_estimate)
  VALUES (NEW.id, v_cefr)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
