-- Migration 010: Add stripe_customer_id to profiles
-- Required by Stripe checkout + portal routes

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Also add processed_stripe_events table if not created by 007
CREATE TABLE IF NOT EXISTS processed_stripe_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text UNIQUE NOT NULL,
  processed_at timestamptz DEFAULT now()
);

-- stripe_event_id is already UNIQUE NOT NULL — the unique constraint creates an implicit index.
-- A redundant explicit index is not needed and was causing migration failure (wrong column name).
