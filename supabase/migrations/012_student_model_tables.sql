-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 012: Student Model Tables
-- ═══════════════════════════════════════════════════════════════════════════
-- Creates the Theory-of-Mind student model tables required by student-model.ts
-- and the security audit log required by api-guard.ts.
--
-- Tables:
--   error_patterns   — per-user grammar error frequency tracking
--   student_beliefs  — AI-inferred misconceptions about German grammar
--   learning_state   — overall CEFR level, native language, accuracy
--   vocabulary_cards — new vocabulary encountered during corrections
--   security_events  — audit log for auth failures, rate limits, etc.
--
-- RPC:
--   upsert_error_pattern — atomic increment + append example (called fire-and-forget)

-- ─── error_patterns ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.error_patterns (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  error_type   TEXT        NOT NULL,
  count        INTEGER     NOT NULL DEFAULT 1 CHECK (count >= 0),
  examples     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  first_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, error_type)
);

ALTER TABLE public.error_patterns ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'error_patterns' AND policyname = 'users_own_error_patterns'
  ) THEN
    CREATE POLICY "users_own_error_patterns"
      ON public.error_patterns
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_error_patterns_user     ON public.error_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_error_patterns_count    ON public.error_patterns(user_id, count DESC);

-- ─── student_beliefs ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.student_beliefs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic        TEXT        NOT NULL,
  belief_text  TEXT        NOT NULL,
  confidence   FLOAT       NOT NULL DEFAULT 0.3 CHECK (confidence >= 0 AND confidence <= 1),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic)
);

ALTER TABLE public.student_beliefs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'student_beliefs' AND policyname = 'users_own_beliefs'
  ) THEN
    CREATE POLICY "users_own_beliefs"
      ON public.student_beliefs
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_student_beliefs_user       ON public.student_beliefs(user_id);
CREATE INDEX IF NOT EXISTS idx_student_beliefs_confidence ON public.student_beliefs(user_id, confidence DESC);

-- ─── learning_state ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.learning_state (
  user_id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cefr_estimate    TEXT        NOT NULL DEFAULT 'A1'
                               CHECK (cefr_estimate IN ('A1','A2','B1','B2','C1','C2')),
  native_language  TEXT        NOT NULL DEFAULT 'English',
  weak_areas       TEXT[]      NOT NULL DEFAULT '{}',
  accuracy_last_10 FLOAT       NOT NULL DEFAULT 0 CHECK (accuracy_last_10 >= 0 AND accuracy_last_10 <= 1),
  correction_count INTEGER     NOT NULL DEFAULT 0 CHECK (correction_count >= 0),
  last_updated     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.learning_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'learning_state' AND policyname = 'users_own_learning_state'
  ) THEN
    CREATE POLICY "users_own_learning_state"
      ON public.learning_state
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ─── vocabulary_cards ─────────────────────────────────────────────────────────
-- The table may already exist from an earlier migration (008).
-- Use ADD COLUMN IF NOT EXISTS to safely add the FSRS scheduling columns
-- without failing when the table was created without them.

CREATE TABLE IF NOT EXISTS public.vocabulary_cards (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  german_word         TEXT        NOT NULL,
  english_translation TEXT        NOT NULL,
  cefr_level          TEXT        NOT NULL DEFAULT 'B1',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, german_word)
);

-- Add FSRS scheduling columns — safe to run even if table already exists
ALTER TABLE public.vocabulary_cards
  ADD COLUMN IF NOT EXISTS due_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS stability   FLOAT       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS difficulty  FLOAT       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reps        INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lapses      INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS state       SMALLINT    NOT NULL DEFAULT 0;

ALTER TABLE public.vocabulary_cards ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vocabulary_cards' AND policyname = 'users_own_vocabulary'
  ) THEN
    CREATE POLICY "users_own_vocabulary"
      ON public.vocabulary_cards
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vocab_user ON public.vocabulary_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_vocab_due  ON public.vocabulary_cards(user_id, due_at ASC);
CREATE INDEX IF NOT EXISTS idx_vocab_cefr ON public.vocabulary_cards(user_id, cefr_level);

-- ─── security_events ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.security_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT        NOT NULL,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address  TEXT,
  metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Security events are service-role only — no user-facing RLS policy
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- No user SELECT policy: only service role can read security events
-- Admins query via service role key, never via client JWT

CREATE INDEX IF NOT EXISTS idx_security_events_type    ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_user    ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON public.security_events(created_at DESC);

-- Plain index on created_at supports the 90-day cleanup query efficiently:
--   DELETE FROM security_events WHERE created_at < now() - interval '90 days'
-- NOTE: partial index with now() is illegal — now() is VOLATILE, not IMMUTABLE.
CREATE INDEX IF NOT EXISTS idx_security_events_expiry
  ON public.security_events(created_at);

-- ─── RPC: upsert_error_pattern ────────────────────────────────────────────────
-- Called from student-model.ts as fire-and-forget after each correction.
-- Atomically increments count and appends example (capped at 10).
-- SECURITY DEFINER runs as table owner, bypassing RLS safely.

-- DROP first: CREATE OR REPLACE cannot change parameter defaults on an existing function
DROP FUNCTION IF EXISTS public.upsert_error_pattern(UUID, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.upsert_error_pattern(
  p_user_id   UUID,
  p_error_type TEXT,
  p_example   JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.error_patterns (user_id, error_type, count, examples, last_seen)
  VALUES (p_user_id, p_error_type, 1, jsonb_build_array(p_example), now())
  ON CONFLICT (user_id, error_type) DO UPDATE SET
    count    = error_patterns.count + 1,
    last_seen = now(),
    examples = (
      -- Keep the most recent 10 examples to cap storage
      SELECT jsonb_agg(elem ORDER BY ordinality DESC)
      FROM (
        SELECT elem, ordinality
        FROM jsonb_array_elements(error_patterns.examples)
          WITH ORDINALITY AS t(elem, ordinality)
        UNION ALL
        SELECT p_example, 999999
      ) combined
      LIMIT 10
    );
END;
$$;

-- Grant execute to authenticated role so the service client can call it
GRANT EXECUTE ON FUNCTION public.upsert_error_pattern(UUID, TEXT, JSONB)
  TO authenticated;
