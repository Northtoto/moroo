-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 015: Leaderboard RPC + Stripe Schema Reconciliation
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Part 1: Fix processed_stripe_events schema conflict ─────────────────────
-- Migration 007 created the table with column "event_id"
-- Migration 010 expected column "stripe_event_id"
-- Webhook code in /api/stripe/webhook/route.ts uses "stripe_event_id"
-- Fix: ensure stripe_event_id exists and is populated from event_id if needed

ALTER TABLE public.processed_stripe_events
  ADD COLUMN IF NOT EXISTS stripe_event_id TEXT;

-- Back-fill any rows created by migration 007's event_id column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processed_stripe_events'
      AND column_name = 'event_id'
  ) THEN
    UPDATE public.processed_stripe_events
    SET stripe_event_id = event_id
    WHERE stripe_event_id IS NULL AND event_id IS NOT NULL;
  END IF;
END $$;

-- Add UNIQUE constraint on stripe_event_id (idempotency key for webhooks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'processed_stripe_events_stripe_event_id_key'
  ) THEN
    ALTER TABLE public.processed_stripe_events
      ADD CONSTRAINT processed_stripe_events_stripe_event_id_key
      UNIQUE (stripe_event_id);
  END IF;
END $$;

-- ─── Part 2: get_leaderboard RPC ─────────────────────────────────────────────
-- Returns top N players ranked by total_xp.
-- SECURITY DEFINER: bypasses RLS so leaderboard shows all users,
-- not just the authenticated user's own row.
-- Only exposes: user_id, display name, avatar, XP, level, streak.
-- Never exposes: email, subscription tier, approval status, or private data.

CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  user_id   UUID,
  full_name TEXT,
  avatar_url TEXT,
  total_xp  INTEGER,
  level     TEXT,
  streak    INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ux.user_id,
    COALESCE(p.full_name, 'Anonym')                    AS full_name,
    p.avatar_url,
    COALESCE(ux.total_xp, 0)                           AS total_xp,
    COALESCE(ux.level, 'A1')                           AS level,
    COALESCE(ds.current_streak, 0)                     AS streak
  FROM public.user_xp ux
  LEFT JOIN public.profiles p      ON p.id = ux.user_id
  LEFT JOIN public.streaks ds ON ds.user_id = ux.user_id
  ORDER BY ux.total_xp DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(INTEGER)
  TO authenticated;

-- ─── Part 3: get_weekly_stats RPC ────────────────────────────────────────────
-- Returns the current user's stats for the weekly challenge card.
-- Reads from usage_quotas (daily totals) summed over the current week.

CREATE OR REPLACE FUNCTION public.get_weekly_stats(
  p_user_id UUID
)
RETURNS TABLE (
  text_corrections  BIGINT,
  audio_corrections BIGINT,
  active_days       BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(uq.text_corrections), 0)  AS text_corrections,
    COALESCE(SUM(uq.audio_corrections), 0) AS audio_corrections,
    COUNT(DISTINCT uq.date)                AS active_days
  FROM public.usage_quotas uq
  WHERE
    uq.user_id = p_user_id
    AND uq.date >= date_trunc('week', now())::date;
$$;

GRANT EXECUTE ON FUNCTION public.get_weekly_stats(UUID)
  TO authenticated;
