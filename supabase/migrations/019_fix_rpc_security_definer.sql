-- ===============================================================================
-- Migration 019: Remove SECURITY DEFINER from RPC functions
-- ===============================================================================
-- SECURITY DEFINER breaks RLS because auth.uid() becomes NULL inside the function
-- Solution: Run functions in user's security context, not postgres role
--
-- Functions affected:
--   - get_due_cards: retrieves user's due flashcards
--   - seed_cards_from_bank: creates initial card deck for new users

-- ─── Re-create get_due_cards WITHOUT SECURITY DEFINER ────────────────────────

DROP FUNCTION IF EXISTS public.get_due_cards(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.get_due_cards(
  p_user_id UUID,
  p_limit   INTEGER DEFAULT 20
)
RETURNS TABLE (
  card_id             UUID,
  german_word         TEXT,
  english_translation TEXT,
  cefr_level          TEXT,
  topic_tags          TEXT[],
  stability           FLOAT,
  due                 TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    card_id,
    german_word,
    english_translation,
    cefr_level,
    topic_tags,
    stability,
    due
  FROM public.card_reviews
  WHERE
    user_id = p_user_id
    AND due <= now()
  ORDER BY due ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_due_cards(UUID, INTEGER)
  TO authenticated;

-- ─── Re-create seed_cards_from_bank WITHOUT SECURITY DEFINER ────────────────

DROP FUNCTION IF EXISTS public.seed_cards_from_bank(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.seed_cards_from_bank(
  p_user_id UUID,
  p_cefr    TEXT DEFAULT 'A1'
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cefr_order TEXT[] := ARRAY['A1','A2','B1','B2','C1','C2'];
  cefr_index INTEGER;
  target_levels TEXT[];
  inserted_count INTEGER;
BEGIN
  cefr_index := array_position(cefr_order, p_cefr);
  IF cefr_index IS NULL THEN
    cefr_index := 1;
  END IF;

  target_levels := cefr_order[1:cefr_index];

  INSERT INTO public.card_reviews (
    user_id,
    vocab_bank_id,
    german_word,
    english_translation,
    cefr_level,
    topic_tags,
    due
  )
  SELECT
    p_user_id,
    vb.id,
    vb.german_word,
    vb.english_translation,
    vb.cefr_level,
    ARRAY[vb.category],
    now()
  FROM public.vocabulary_bank vb
  WHERE vb.cefr_level = ANY(target_levels)
  ON CONFLICT (user_id, german_word) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_cards_from_bank(UUID, TEXT)
  TO authenticated;
