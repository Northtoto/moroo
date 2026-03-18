-- ============================================================
-- Migration 009: WhatsApp Daily Bot Settings
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsapp_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  opted_in boolean DEFAULT false,
  preferred_time time DEFAULT '08:00:00',
  show_in_native_language boolean DEFAULT false,
  daily_lesson_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Processed WhatsApp messages (deduplication)
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_message_id text UNIQUE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  direction text CHECK (direction IN ('inbound','outbound')),
  message_text text,
  processed_at timestamptz DEFAULT now()
);

-- Rate limiting for WhatsApp (1 message per 5s per phone)
CREATE TABLE IF NOT EXISTS whatsapp_rate_limits (
  phone_number text PRIMARY KEY,
  last_message_at timestamptz DEFAULT now(),
  message_count_today integer DEFAULT 0,
  blocked_until timestamptz
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_phone ON whatsapp_settings(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON whatsapp_messages(phone_number);

-- RLS
ALTER TABLE whatsapp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own whatsapp"
  ON whatsapp_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service whatsapp settings"
  ON whatsapp_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service whatsapp messages"
  ON whatsapp_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service rate limits"
  ON whatsapp_rate_limits FOR ALL TO service_role USING (true) WITH CHECK (true);
