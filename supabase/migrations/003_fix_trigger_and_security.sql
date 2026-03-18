-- Fix the trigger to handle errors gracefully
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, approval_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'pending'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- 2026 SECURITY HARDENING
-- =====================================================================

-- Add security audit columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS failed_login_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_ip INET;

-- Security events audit log
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'login_success', 'login_failure', 'logout',
    'password_change', 'password_reset_request',
    'mfa_enroll', 'mfa_verify', 'mfa_disable',
    'account_locked', 'account_unlocked',
    'admin_action', 'session_revoked',
    'suspicious_activity', 'brute_force_detected'
  )),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON security_events(ip_address);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Only admins can read security events; system inserts via service role
CREATE POLICY "Admins read security events" ON security_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));

-- Active sessions tracking
CREATE TABLE IF NOT EXISTS active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  device_fingerprint TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires ON active_sessions(expires_at);

ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own sessions" ON active_sessions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete own sessions" ON active_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Admin policy: admins can read all profiles (needed for admin dashboard)
CREATE POLICY "Admins read all profiles" ON profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

-- Admin policy: admins can update all profiles
CREATE POLICY "Admins update all profiles" ON profiles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

-- Admin policy: admins can manage all courses
CREATE POLICY "Admins manage courses" ON courses FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));

-- Rate limiting table for API endpoints
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- IP or user_id
  endpoint TEXT NOT NULL,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  request_count INTEGER DEFAULT 1,
  UNIQUE(identifier, endpoint, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits(identifier, endpoint, window_start);
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- No public access to rate_limits — service role only

-- Function to clean up expired sessions and old rate limits
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
  DELETE FROM active_sessions WHERE expires_at < NOW();
  DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
  DELETE FROM security_events WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
