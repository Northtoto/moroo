-- ===============================================================================
-- Migration 018: Security Hardening
-- ===============================================================================
-- Fixes identified by comprehensive security audit 2026-03-17:
--
-- 1. CRITICAL: Enable RLS on processed_stripe_events (was missing)
-- 2. CRITICAL: Add input validation to check_and_increment_quota()
-- 3. HIGH:     Add auth.uid() ownership checks to SECURITY DEFINER RPCs
-- 4. HIGH:     Validate p_cefr in seed_cards_from_bank()
-- 5. HIGH:     Validate p_error_type length in upsert_error_pattern()
--
-- This migration is fully idempotent — safe to run multiple times.

-- ─── 1. RLS on processed_stripe_events ────────────────────────────────────────
-- Only service_role should access this table (webhook handler).
-- No user should ever query Stripe event IDs directly.

ALTER TABLE IF EXISTS public.processed_stripe_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'processed_stripe_events'
      AND policyname = 'service_role_only_stripe_events'
  ) THEN
    -- Deny all access to anon/authenticated; only service_role bypasses RLS
    CREATE POLICY "service_role_only_stripe_events"
      ON public.processed_stripe_events
      FOR ALL
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

-- ─── 2. Harden check_and_increment_quota: reject invalid p_type ──────────────

CREATE OR REPLACE FUNCTION check_and_increment_quota(
  p_user_id uuid,
  p_type text  -- 'text' | 'audio' | 'ocr' | 'voice'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_limits jsonb;
  v_limit integer;
  v_col text;
  v_current integer;
BEGIN
  -- ★ SECURITY: Validate p_type against whitelist (prevents column injection)
  IF p_type NOT IN ('text', 'audio', 'ocr', 'voice') THEN
    RAISE EXCEPTION 'Invalid quota type: %. Allowed: text, audio, ocr, voice', p_type;
  END IF;

  -- ★ SECURITY: Verify caller owns this user_id
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied: cannot check quota for another user';
  END IF;

  -- Get current subscription tier
  SELECT COALESCE(tier, 'free') INTO v_tier
  FROM subscriptions WHERE user_id = p_user_id
  AND status = 'active';

  IF v_tier IS NULL THEN v_tier := 'free'; END IF;

  -- Map type to column name (safe after whitelist check)
  v_col := CASE p_type
    WHEN 'text' THEN 'text_corrections'
    WHEN 'audio' THEN 'audio_corrections'
    WHEN 'ocr' THEN 'ocr_corrections'
    WHEN 'voice' THEN 'voice_minutes'
  END;

  -- Get limit for this tier
  v_limits := get_tier_limits(v_tier);
  v_limit := (v_limits->>(v_col))::integer;

  -- Ensure today's quota row exists
  INSERT INTO usage_quotas (user_id, date)
  VALUES (p_user_id, CURRENT_DATE)
  ON CONFLICT (user_id, date) DO NOTHING;

  -- Get current usage
  EXECUTE format(
    'SELECT %I FROM usage_quotas WHERE user_id = $1 AND date = CURRENT_DATE',
    v_col
  ) INTO v_current USING p_user_id;

  IF v_current IS NULL THEN v_current := 0; END IF;

  -- Check against limit (-1 = unlimited)
  IF v_limit >= 0 AND v_current >= v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'current', v_current,
      'limit', v_limit,
      'tier', v_tier,
      'upgrade_url', '/pricing'
    );
  END IF;

  -- Atomically increment
  EXECUTE format(
    'UPDATE usage_quotas SET %I = %I + 1 WHERE user_id = $1 AND date = CURRENT_DATE',
    v_col, v_col
  ) USING p_user_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'current', v_current + 1,
    'limit', v_limit,
    'tier', v_tier
  );
END;
$$;

-- ─── 3. Harden get_due_cards: ownership check ────────────────────────────────

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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ★ SECURITY: Only allow users to query their own cards
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied: cannot read another user''s cards';
  END IF;

  -- ★ SECURITY: Cap limit to prevent excessive data retrieval
  IF p_limit > 100 THEN p_limit := 100; END IF;
  IF p_limit < 1 THEN p_limit := 1; END IF;

  RETURN QUERY
    SELECT
      cr.card_id,
      cr.german_word,
      cr.english_translation,
      cr.cefr_level,
      cr.topic_tags,
      cr.stability,
      cr.due
    FROM public.card_reviews cr
    WHERE
      cr.user_id = p_user_id
      AND cr.due <= now()
    ORDER BY cr.due ASC
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_due_cards(UUID, INTEGER)
  TO authenticated;

-- ─── 4. Harden seed_cards_from_bank: strict CEFR validation ──────────────────

DROP FUNCTION IF EXISTS public.seed_cards_from_bank(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.seed_cards_from_bank(
  p_user_id UUID,
  p_cefr    TEXT DEFAULT 'A1'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cefr_order TEXT[] := ARRAY['A1','A2','B1','B2','C1','C2'];
  cefr_index INTEGER;
  target_levels TEXT[];
  inserted_count INTEGER;
BEGIN
  -- ★ SECURITY: Only allow users to seed their own cards
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied: cannot seed cards for another user';
  END IF;

  -- ★ SECURITY: Strict CEFR validation (reject invalid values)
  IF p_cefr NOT IN ('A1','A2','B1','B2','C1','C2') THEN
    RAISE EXCEPTION 'Invalid CEFR level: %. Allowed: A1, A2, B1, B2, C1, C2', p_cefr;
  END IF;

  cefr_index := array_position(cefr_order, p_cefr);
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

-- ─── 5. Harden upsert_error_pattern: input validation ────────────────────────
-- (Only replace if function exists — migration 012 may or may not have run)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'upsert_error_pattern'
  ) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.upsert_error_pattern(
        p_user_id   UUID,
        p_error_type TEXT,
        p_example   JSONB DEFAULT '{}'::jsonb
      )
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      BEGIN
        -- ★ SECURITY: Ownership check
        IF auth.uid() IS DISTINCT FROM p_user_id THEN
          RAISE EXCEPTION 'Access denied';
        END IF;

        -- ★ SECURITY: Validate error_type length and content
        IF LENGTH(p_error_type) > 100 THEN
          RAISE EXCEPTION 'error_type too long (max 100 chars)';
        END IF;
        IF p_error_type ~ '[<>"'']' THEN
          RAISE EXCEPTION 'error_type contains invalid characters';
        END IF;

        INSERT INTO public.error_patterns (user_id, error_type, count, examples, last_seen)
        VALUES (p_user_id, p_error_type, 1, jsonb_build_array(p_example), now())
        ON CONFLICT (user_id, error_type) DO UPDATE SET
          count     = error_patterns.count + 1,
          examples  = (error_patterns.examples || jsonb_build_array(p_example))::jsonb,
          last_seen = now();
      END;
      $body$;
    $fn$;
  END IF;
END $$;
