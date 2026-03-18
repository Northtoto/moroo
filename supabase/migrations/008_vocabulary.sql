-- ============================================================
-- Migration 008: FSRS Vocabulary + Spaced Repetition
-- Uses ts-fsrs algorithm fields client-side, syncs to Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS vocabulary_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  german_word text NOT NULL,
  english_translation text NOT NULL,
  example_sentence text,
  audio_url text,
  image_url text,
  cefr_level text DEFAULT 'A1' CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  topic_tags text[] DEFAULT '{}',
  source_correction_id uuid,           -- links back to the correction that created this card
  created_at timestamptz DEFAULT now()
);

-- FSRS review state per user per card
CREATE TABLE IF NOT EXISTS card_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES vocabulary_cards(id) ON DELETE CASCADE,
  -- ts-fsrs algorithm fields (see: github.com/open-spaced-repetition/ts-fsrs)
  stability float DEFAULT 1.0,         -- memory stability (days)
  difficulty float DEFAULT 5.0,        -- 1-10 scale
  due timestamptz DEFAULT now(),       -- next review date
  lapses integer DEFAULT 0,            -- number of times forgotten
  reps integer DEFAULT 0,              -- total reviews
  state text DEFAULT 'new'
    CHECK (state IN ('new','learning','review','relearning')),
  last_review timestamptz,
  elapsed_days integer DEFAULT 0,
  scheduled_days integer DEFAULT 0,
  UNIQUE(user_id, card_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vocab_cards_user ON vocabulary_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_vocab_cards_cefr ON vocabulary_cards(user_id, cefr_level);
CREATE INDEX IF NOT EXISTS idx_card_reviews_user ON card_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_card_reviews_due ON card_reviews(user_id, due ASC);
CREATE INDEX IF NOT EXISTS idx_card_reviews_state ON card_reviews(user_id, state);

-- RLS
ALTER TABLE vocabulary_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own vocab" ON vocabulary_cards
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own reviews" ON card_reviews
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service vocab" ON vocabulary_cards
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service reviews" ON card_reviews
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Get cards due for review today
CREATE OR REPLACE FUNCTION get_due_cards(p_user_id uuid, p_limit int DEFAULT 20)
RETURNS TABLE(
  card_id uuid, german_word text, english_translation text,
  example_sentence text, cefr_level text,
  stability float, difficulty float, state text, reps integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vc.id, vc.german_word, vc.english_translation,
    vc.example_sentence, vc.cefr_level,
    COALESCE(cr.stability, 1.0),
    COALESCE(cr.difficulty, 5.0),
    COALESCE(cr.state, 'new'),
    COALESCE(cr.reps, 0)
  FROM vocabulary_cards vc
  LEFT JOIN card_reviews cr ON cr.card_id = vc.id AND cr.user_id = p_user_id
  WHERE vc.user_id = p_user_id
    AND (cr.due IS NULL OR cr.due <= now())
  ORDER BY
    CASE COALESCE(cr.state, 'new')
      WHEN 'new' THEN 3
      WHEN 'learning' THEN 1
      WHEN 'relearning' THEN 2
      WHEN 'review' THEN 4
    END ASC,
    COALESCE(cr.due, '1970-01-01') ASC
  LIMIT p_limit;
END;
$$;
