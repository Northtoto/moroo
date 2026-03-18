-- ============================================================
-- Migration 006: Theory-of-Mind Student Model
-- Inspired by tutor-gpt's Honcho metamessage architecture
-- but self-hosted in Supabase
-- ============================================================

-- Student belief model: what the AI infers the student believes
-- about German grammar rules
CREATE TABLE IF NOT EXISTS student_beliefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic text NOT NULL,                 -- e.g. 'accusative_case', 'verb_position'
  belief_text text NOT NULL,           -- "Student believes Dativ and Akkusativ are interchangeable"
  confidence float DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  source_correction_id uuid,           -- which correction triggered this belief inference
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Error pattern tracking: aggregate counts per error type
CREATE TABLE IF NOT EXISTS error_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  error_type text NOT NULL,            -- e.g. 'accusative_case', 'word_order', 'verb_conjugation'
  count integer DEFAULT 1,
  last_seen timestamptz DEFAULT now(),
  examples jsonb DEFAULT '[]'::jsonb,  -- last 5 examples: [{original, corrected}]
  UNIQUE(user_id, error_type)
);

-- Learning state: current CEFR estimate + weak/strong areas
CREATE TABLE IF NOT EXISTS learning_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cefr_estimate text DEFAULT 'A1' CHECK (cefr_estimate IN ('A1','A2','B1','B2','C1','C2')),
  weak_areas text[] DEFAULT '{}',      -- topics needing work
  strong_areas text[] DEFAULT '{}',    -- topics mastered
  native_language text DEFAULT 'English',
  accuracy_last_10 float DEFAULT 0.0,  -- 0.0–1.0
  total_corrections integer DEFAULT 0,
  consecutive_same_error integer DEFAULT 0,
  last_updated timestamptz DEFAULT now()
);

-- Add native_language to profiles for L1 adaptation
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS native_language text DEFAULT 'English';

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_student_beliefs_user ON student_beliefs(user_id);
CREATE INDEX IF NOT EXISTS idx_student_beliefs_topic ON student_beliefs(user_id, topic);
CREATE INDEX IF NOT EXISTS idx_error_patterns_user ON error_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_error_patterns_count ON error_patterns(user_id, count DESC);

-- Row Level Security
ALTER TABLE student_beliefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_state ENABLE ROW LEVEL SECURITY;

-- User policies
CREATE POLICY "Users manage own beliefs"
  ON student_beliefs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own error patterns"
  ON error_patterns FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own learning state"
  ON learning_state FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role bypass (for n8n + server-side API routes)
CREATE POLICY "Service role beliefs"
  ON student_beliefs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role errors"
  ON error_patterns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role learning"
  ON learning_state FOR ALL TO service_role USING (true) WITH CHECK (true);

-- SECURITY DEFINER: upsert error pattern safely
CREATE OR REPLACE FUNCTION upsert_error_pattern(
  p_user_id uuid,
  p_error_type text,
  p_example jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO error_patterns (user_id, error_type, count, examples)
  VALUES (
    p_user_id,
    p_error_type,
    1,
    CASE WHEN p_example IS NOT NULL THEN jsonb_build_array(p_example) ELSE '[]'::jsonb END
  )
  ON CONFLICT (user_id, error_type) DO UPDATE SET
    count = error_patterns.count + 1,
    last_seen = now(),
    examples = CASE
      WHEN p_example IS NOT NULL THEN
        -- Keep last 5 examples
        (SELECT jsonb_agg(e) FROM (
          SELECT e FROM jsonb_array_elements(
            jsonb_build_array(p_example) || error_patterns.examples
          ) e LIMIT 5
        ) sub)
      ELSE error_patterns.examples
    END;
END;
$$;

-- SECURITY DEFINER: get top N error patterns for a user
CREATE OR REPLACE FUNCTION get_top_errors(p_user_id uuid, p_limit int DEFAULT 3)
RETURNS TABLE(error_type text, count integer, examples jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ep.error_type, ep.count, ep.examples
  FROM error_patterns ep
  WHERE ep.user_id = p_user_id
  ORDER BY ep.count DESC
  LIMIT p_limit;
END;
$$;
