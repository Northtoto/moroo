-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 014: Card Reviews Table + FSRS RPCs
-- ═══════════════════════════════════════════════════════════════════════════
-- Connects the vocabulary_bank (migration 013) to per-user FSRS scheduling.
--
-- Tables:
--   card_reviews — one row per (user, vocabulary word), holds all FSRS state
--
-- RPCs:
--   get_due_cards(p_user_id, p_limit)       → cards due for review today
--   seed_cards_from_bank(p_user_id, p_cefr) → bootstrap new user's deck
--
-- FSRS fields match the ts-fsrs Card interface used in /api/flashcards/review

-- ─── card_reviews ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.card_reviews (
  -- Identity
  card_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vocab_bank_id    UUID        REFERENCES public.vocabulary_bank(id) ON DELETE SET NULL,

  -- Denormalised vocabulary data (fast reads, no joins in hot path)
  german_word         TEXT        NOT NULL,
  english_translation TEXT        NOT NULL,
  cefr_level          TEXT        NOT NULL DEFAULT 'A1',
  topic_tags          TEXT[]      NOT NULL DEFAULT '{}',

  -- FSRS scheduling state (mirrors ts-fsrs Card interface)
  due              TIMESTAMPTZ NOT NULL DEFAULT now(),
  stability        FLOAT       NOT NULL DEFAULT 0,
  difficulty       FLOAT       NOT NULL DEFAULT 0,
  elapsed_days     INTEGER     NOT NULL DEFAULT 0,
  scheduled_days   INTEGER     NOT NULL DEFAULT 0,
  reps             INTEGER     NOT NULL DEFAULT 0,
  lapses           INTEGER     NOT NULL DEFAULT 0,
  state            SMALLINT    NOT NULL DEFAULT 0,  -- 0=New 1=Learning 2=Review 3=Relearning
  last_review      TIMESTAMPTZ,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A user can only have one review row per vocabulary word
  UNIQUE (user_id, german_word)
);

-- DISABLED: Column additions moved to migration 016_fixup_card_reviews.sql
-- The inline REFERENCES clause on vocab_bank_id causes failures when card_reviews
-- pre-exists without that column. Migration 016 adds columns individually without
-- inline FK, then adds the constraint separately with a DO $$ guard.
-- ALTER TABLE public.card_reviews ADD COLUMN IF NOT EXISTS vocab_bank_id ...
-- ALTER TABLE public.card_reviews ADD COLUMN IF NOT EXISTS english_translation ...
-- ALTER TABLE public.card_reviews ADD COLUMN IF NOT EXISTS cefr_level ...
-- (see migration 016 for the complete column list)

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

-- DISABLED: Indexes moved to migration 016 (depend on columns added there)
-- CREATE INDEX IF NOT EXISTS idx_card_reviews_user_due ON public.card_reviews(user_id, due ASC);
-- CREATE INDEX IF NOT EXISTS idx_card_reviews_user_cefr ON public.card_reviews(user_id, cefr_level);

-- DISABLED: RPCs moved to migration 016_fixup_card_reviews.sql
-- These functions reference columns (german_word, cefr_level, etc.) that are
-- added by migration 016. They cannot be created here because the columns
-- don't exist yet when this migration runs on an existing card_reviews table.
-- See migration 016 for: get_due_cards, seed_cards_from_bank
