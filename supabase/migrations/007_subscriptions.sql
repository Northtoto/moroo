-- ============================================================
-- Migration 007: Stripe Subscriptions + Usage Quotas
-- Pattern from tutor-gpt: products/prices synced from Stripe,
-- subscription lifecycle managed via webhooks
-- ============================================================

-- Stripe product catalog (synced from Stripe via webhook)
CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,                 -- Stripe product ID
  active boolean DEFAULT true,
  name text NOT NULL,
  description text,
  image text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Stripe prices
CREATE TABLE IF NOT EXISTS prices (
  id text PRIMARY KEY,                 -- Stripe price ID
  product_id text REFERENCES products(id) ON DELETE CASCADE,
  active boolean DEFAULT true,
  currency text DEFAULT 'usd',
  interval text CHECK (interval IN ('day','week','month','year')),
  interval_count integer DEFAULT 1,
  unit_amount bigint,                  -- in cents
  type text DEFAULT 'recurring' CHECK (type IN ('one_time','recurring')),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- User subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free','pro','premium')),
  status text NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('active','canceled','incomplete','incomplete_expired',
                      'past_due','trialing','unpaid','inactive')),
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  price_id text REFERENCES prices(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Daily usage quotas (server-side enforced, never trust client)
CREATE TABLE IF NOT EXISTS usage_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  text_corrections integer DEFAULT 0,
  audio_corrections integer DEFAULT 0,
  ocr_corrections integer DEFAULT 0,
  voice_minutes integer DEFAULT 0,
  flashcard_reviews integer DEFAULT 0,
  UNIQUE(user_id, date)
);

-- Stripe webhook idempotency (prevent double-processing)
CREATE TABLE IF NOT EXISTS processed_stripe_events (
  event_id text PRIMARY KEY,
  event_type text,
  processed_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_usage_quotas_user_date ON usage_quotas(user_id, date);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_stripe_events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users read own subscription"
  ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own quotas"
  ON usage_quotas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone reads products"
  ON products FOR SELECT USING (active = true);
CREATE POLICY "Anyone reads prices"
  ON prices FOR SELECT USING (active = true);

-- Service role
CREATE POLICY "Service subscriptions"
  ON subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service quotas"
  ON usage_quotas FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service products"
  ON products FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service prices"
  ON prices FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service events"
  ON processed_stripe_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Quota limits per tier (returns -1 for unlimited)
CREATE OR REPLACE FUNCTION get_tier_limits(p_tier text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_tier
    WHEN 'pro' THEN jsonb_build_object(
      'text_corrections', -1,
      'audio_corrections', 20,
      'ocr_corrections', 10,
      'voice_minutes', 30
    )
    WHEN 'premium' THEN jsonb_build_object(
      'text_corrections', -1,
      'audio_corrections', -1,
      'ocr_corrections', -1,
      'voice_minutes', -1
    )
    ELSE jsonb_build_object(
      'text_corrections', 10,
      'audio_corrections', 3,
      'ocr_corrections', 2,
      'voice_minutes', 0
    )
  END;
$$;

-- SECURITY DEFINER: atomic quota check + increment
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
  -- Get current subscription tier
  SELECT COALESCE(tier, 'free') INTO v_tier
  FROM subscriptions WHERE user_id = p_user_id
  AND status = 'active';

  IF v_tier IS NULL THEN v_tier := 'free'; END IF;

  -- Map type to column name
  v_col := CASE p_type
    WHEN 'text' THEN 'text_corrections'
    WHEN 'audio' THEN 'audio_corrections'
    WHEN 'ocr' THEN 'ocr_corrections'
    WHEN 'voice' THEN 'voice_minutes'
    ELSE 'text_corrections'
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
