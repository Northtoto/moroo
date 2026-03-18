-- ===============================================================================
-- Migration 016: Fix card_reviews columns + re-create RPCs
-- ===============================================================================
-- Fixes the failure in migration 014 where ALTER TABLE ADD COLUMN with inline
-- REFERENCES failed because card_reviews pre-existed without those columns.
--
-- Strategy:
--   1. Add each column individually WITHOUT inline FK (plain types only)
--   2. Add FK constraint separately with DO $$ IF NOT EXISTS guard
--   3. Re-assert indexes with IF NOT EXISTS
--   4. DROP + CREATE RPCs (get_due_cards, seed_cards_from_bank)
--   5. Add delete_user_data RPC for GDPR compliance
--
-- This migration is fully idempotent — safe to run multiple times.

-- ─── Ensure card_reviews table exists ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.card_reviews (
  card_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  german_word      TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, german_word)
);

-- ─── Add columns individually — no inline FK ────────────────────────────────────
-- NOTE: german_word must be added FIRST (RPCs and UNIQUE constraint depend on it)

ALTER TABLE public.card_reviews ADD COLUMN IF NOT EXISTS german_word         TEXT        NOT NULL DEFAULT '';
ALTER TABLE public.card_reviews ADD COLUMN IF NOT EXISTS vocab_bank_id       UUID;
ALTER TABLE public.card_reviews ADD COLUMN IF NOT EXISTS english_translation TEXT        NOT NULL DEFAULT '';
ALTER TABLE public.card_reviews ADD COLUMN IF NOT EXISTS cefr_level          TEXT        NOT NULL DEFAULT 'A1';
ALTER TABLE public.card_reviews ADD COLUMN IF NOT EXISTS topic_tags          TEXT[]      NOT NULL DEFAULT '{}';
ALTER TABLE public.card_reviews ADD COLUMN IF NOT EXISTS due                 TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.card_reviews ADD COLUMN IF NOT EXISTS stability           FLOAT       NOT NULL DEFAULT 0;
ALTER TABLE public.card_reviews ADD COLUMN IF NOT EXISTS difficulty          FLOAT       NOT NULL DEFAULT 0;
ALTER TABLE public.card_reviews ADD COLUMN IF NOT EXISTS elapsed_days        INTEGER     NOT NULL DEFAULT 0;
ALTER TABLE public.card_reviews ADD COLUMN IF NOT EXISTS scheduled_days      INTEGER     NOT NULL DEFAULT 0;
ALTER TABLE public.card_reviews ADD COLUMN IF NOT EXISTS reps                INTEGER     NOT NULL DEFAULT 0;
ALTER TABLE public.card_reviews ADD COLUMN IF NOT EXISTS lapses              INTEGER     NOT NULL DEFAULT 0;
ALTER TABLE public.card_reviews ADD COLUMN IF NOT EXISTS state               SMALLINT    NOT NULL DEFAULT 0;
ALTER TABLE public.card_reviews ADD COLUMN IF NOT EXISTS last_review         TIMESTAMPTZ;

-- ─── UNIQUE constraint on (user_id, german_word) ────────────────────────────────
-- Migration 008's version of card_reviews didn't have this constraint.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'card_reviews_user_id_german_word_key'
      OR  conname = 'card_reviews_user_id_german_word_key1'
  ) THEN
    ALTER TABLE public.card_reviews
      ADD CONSTRAINT card_reviews_user_id_german_word_key UNIQUE (user_id, german_word);
  END IF;
END $$;

-- ─── FK constraint (added separately to avoid inline REFERENCES failure) ────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'card_reviews_vocab_bank_id_fkey'
  ) THEN
    ALTER TABLE public.card_reviews
      ADD CONSTRAINT card_reviews_vocab_bank_id_fkey
      FOREIGN KEY (vocab_bank_id) REFERENCES public.vocabulary_bank(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── RLS ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.card_reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'card_reviews' AND policyname = 'users_own_card_reviews'
  ) THEN
    CREATE POLICY "users_own_card_reviews"
      ON public.card_reviews
      FOR ALL
      USING  (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ─── Indexes ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_card_reviews_user_due
  ON public.card_reviews(user_id, due ASC);

CREATE INDEX IF NOT EXISTS idx_card_reviews_user_cefr
  ON public.card_reviews(user_id, cefr_level);

-- ─── RPC: get_due_cards ─────────────────────────────────────────────────────────

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

-- ─── RPC: seed_cards_from_bank ──────────────────────────────────────────────────

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

-- ─── RPC: delete_user_data (GDPR compliance) ────────────────────────────────────
-- Cascading delete of all user data across every table.
-- Called from /api/user/delete endpoint with service role.

DROP FUNCTION IF EXISTS public.delete_user_data(UUID);

CREATE OR REPLACE FUNCTION public.delete_user_data(
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.card_reviews      WHERE user_id = p_user_id;
  DELETE FROM public.vocabulary_cards   WHERE user_id = p_user_id;
  DELETE FROM public.error_patterns     WHERE user_id = p_user_id;
  DELETE FROM public.student_beliefs    WHERE user_id = p_user_id;
  DELETE FROM public.learning_state     WHERE user_id = p_user_id;
  DELETE FROM public.enrollments        WHERE user_id = p_user_id;
  DELETE FROM public.security_events    WHERE user_id = p_user_id;
  DELETE FROM public.messages           WHERE user_id = p_user_id;
  DELETE FROM public.tutor_sessions     WHERE user_id = p_user_id;
  DELETE FROM public.user_xp            WHERE user_id = p_user_id;
  DELETE FROM public.streaks            WHERE user_id = p_user_id;
  DELETE FROM public.user_badges        WHERE user_id = p_user_id;
  DELETE FROM public.leagues            WHERE user_id = p_user_id;
  DELETE FROM public.subscriptions      WHERE user_id = p_user_id;
  DELETE FROM public.usage_quotas       WHERE user_id = p_user_id;
  DELETE FROM public.active_sessions    WHERE user_id = p_user_id;
  DELETE FROM public.profiles           WHERE id      = p_user_id;
END;
$$;
