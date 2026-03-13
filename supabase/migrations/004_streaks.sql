-- Add streak tracking to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activity_date DATE;

-- Add german_level preference
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS german_level TEXT CHECK (german_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

-- Add bio / learning goal
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS learning_goal TEXT;

-- Function: increment streak when user submits a correction
-- Called from the application layer after a successful correction.
-- This function is idempotent — calling it multiple times on the same day has no effect.
CREATE OR REPLACE FUNCTION increment_streak(p_user_id UUID)
RETURNS void AS $$
DECLARE
  today DATE := CURRENT_DATE;
  last_date DATE;
BEGIN
  SELECT last_activity_date INTO last_date
    FROM profiles WHERE id = p_user_id;

  IF last_date IS NULL OR last_date < today - INTERVAL '1 day' THEN
    -- Reset streak if more than 1 day gap
    UPDATE profiles
      SET current_streak = CASE WHEN last_date = today - 1 THEN current_streak + 1 ELSE 1 END,
          longest_streak = GREATEST(longest_streak, CASE WHEN last_date = today - 1 THEN current_streak + 1 ELSE 1 END),
          last_activity_date = today
      WHERE id = p_user_id;
  ELSIF last_date = today THEN
    -- Already recorded today, just update last_activity_date (no-op on streak)
    NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
