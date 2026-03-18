-- ═══════════════════════════════════════════════
-- MORODEUTSCH GAMIFICATION SYSTEM
-- ═══════════════════════════════════════════════

-- XP tracking per user
CREATE TABLE IF NOT EXISTS user_xp (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp   INTEGER NOT NULL DEFAULT 0,
  level      TEXT NOT NULL DEFAULT 'A1' CHECK (level IN ('A1','A2','B1','B2','C1','C2')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Streak tracking
CREATE TABLE IF NOT EXISTS streaks (
  user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active    DATE DEFAULT CURRENT_DATE,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Badges catalogue
CREATE TABLE IF NOT EXISTS badges (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL UNIQUE,
  description      TEXT,
  icon             TEXT,
  xp_required      INTEGER DEFAULT 0,
  unlock_condition TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- User earned badges
CREATE TABLE IF NOT EXISTS user_badges (
  user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id  UUID REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

-- Leaderboard / leagues
CREATE TABLE IF NOT EXISTS leagues (
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tier       TEXT NOT NULL DEFAULT 'Bronze' CHECK (tier IN ('Bronze','Silver','Gold','Platinum','Diamond')),
  weekly_xp  INTEGER NOT NULL DEFAULT 0,
  season     TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-W'),
  PRIMARY KEY (user_id, season)
);

-- Correction cache (deduplicate identical corrections)
CREATE TABLE IF NOT EXISTS correction_cache (
  hash        TEXT PRIMARY KEY,
  original    TEXT NOT NULL,
  corrected   TEXT NOT NULL,
  explanation TEXT,
  hits        INTEGER DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────
-- SEED: Default badges
-- ───────────────────────────────────────────────
INSERT INTO badges (name, description, icon, unlock_condition) VALUES
  ('Erste Schritte',  'Erste Korrektur eingereicht',      '🎯', 'first_correction'),
  ('Flamme',          '7-Tage-Serie erreicht',             '🔥', 'streak_7'),
  ('Inferno',         '30-Tage-Serie erreicht',            '🌋', 'streak_30'),
  ('Perfektionist',   '10 fehlerfreie Sessions',           '✨', 'perfect_10'),
  ('Vielredner',      '100 Audio-Korrekturen',             '🎙️', 'audio_100'),
  ('Fotograf',        '50 OCR-Korrekturen',                '📸', 'ocr_50'),
  ('Grammatikmeister','Stufe B2 erreicht',                 '📖', 'reach_b2'),
  ('Deutschprofi',    'Stufe C1 erreicht',                 '🏆', 'reach_c1')
ON CONFLICT (name) DO NOTHING;

-- ───────────────────────────────────────────────
-- RPC: award_xp(p_user_id, p_xp)
-- Adds XP, recalculates CEFR level, updates streak
-- ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION award_xp(p_user_id UUID, p_xp INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER;
  v_level TEXT;
BEGIN
  -- Upsert XP
  INSERT INTO user_xp (user_id, total_xp, level)
  VALUES (p_user_id, p_xp, 'A1')
  ON CONFLICT (user_id) DO UPDATE
    SET total_xp = user_xp.total_xp + p_xp,
        updated_at = NOW();

  SELECT total_xp INTO v_total FROM user_xp WHERE user_id = p_user_id;

  -- Calculate CEFR
  v_level := CASE
    WHEN v_total < 100  THEN 'A1'
    WHEN v_total < 300  THEN 'A2'
    WHEN v_total < 700  THEN 'B1'
    WHEN v_total < 1500 THEN 'B2'
    WHEN v_total < 3000 THEN 'C1'
    ELSE 'C2'
  END;

  UPDATE user_xp SET level = v_level WHERE user_id = p_user_id;

  -- Update streak
  INSERT INTO streaks (user_id, current_streak, longest_streak, last_active)
  VALUES (p_user_id, 1, 1, CURRENT_DATE)
  ON CONFLICT (user_id) DO UPDATE
    SET current_streak = CASE
          WHEN streaks.last_active = CURRENT_DATE - INTERVAL '1 day' THEN streaks.current_streak + 1
          WHEN streaks.last_active = CURRENT_DATE THEN streaks.current_streak
          ELSE 1
        END,
        longest_streak = GREATEST(streaks.longest_streak,
          CASE
            WHEN streaks.last_active = CURRENT_DATE - INTERVAL '1 day' THEN streaks.current_streak + 1
            ELSE 1
          END),
        last_active = CURRENT_DATE,
        updated_at = NOW();
END;
$$;

-- ───────────────────────────────────────────────
-- RLS policies
-- ───────────────────────────────────────────────
ALTER TABLE user_xp    ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own xp"
  ON user_xp FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users can read own streak"
  ON streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users can read own badges"
  ON user_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users can read league"
  ON leagues FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "anyone reads badges catalogue"
  ON badges FOR SELECT TO authenticated USING (true);
