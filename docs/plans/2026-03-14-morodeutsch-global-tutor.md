# Morodeutsch Global AI Tutor — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Morodeutsch into the world's most advanced AI German tutor for global students, adding Theory-of-Mind student modeling, L1 adaptation, FSRS flashcards, Stripe monetization, real-time voice, pronunciation scoring, WhatsApp bot, and adaptive news reading.

**Architecture:** Supabase-backed student belief model (inspired by tutor-gpt's Honcho, self-hosted) + two-pass LLM (silent thought → visible correction) in n8n + react-speech-recognition with Azure polyfill for real-time German STT + ts-fsrs for spaced repetition + Stripe webhooks syncing to Supabase subscriptions.

**Tech Stack:** Next.js 16.1.6, React 19, TypeScript strict, Supabase, Azure OpenAI GPT-5.3-chat, Azure Speech SDK, react-speech-recognition, ts-fsrs, Stripe, n8n v1

**Key Learnings from Reference Repos:**
- tutor-gpt: Two-pass LLM (thought → response), Stripe products synced to Supabase, Arcjet rate limiting
- react-speech-recognition: `useSpeechRecognition({ transcribing, commands })`, `SpeechRecognition.startListening({ continuous: true, language: 'de-DE' })`, Azure polyfill via `web-speech-cognitive-services`, use `abortListening` (not `stopListening`) with Azure + continuous mode

---

## PHASE 1 — Core Intelligence

### Task 1: Install NPM Packages

**Files:** `package.json`

**Step 1: Install all Phase 1 packages**
```bash
cd /c/Users/Administrateur/Downloads/morodeutsh
npm install stripe @stripe/stripe-js react-speech-recognition microsoft-cognitiveservices-speech-sdk ts-fsrs zod web-speech-cognitive-services
```

**Step 2: Install type definitions**
```bash
npm install --save-dev @types/react-speech-recognition
```

**Step 3: Verify no breaking changes**
```bash
npm run build 2>&1 | tail -20
```

**Step 4: Commit**
```bash
git add package.json package-lock.json
git commit -m "feat: install global tutor packages (stripe, speech-recognition, ts-fsrs, zod)"
```

---

### Task 2: Database Migration 005 — Gamification (already exists, verify)

**Files:** `supabase/migrations/005_gamification.sql`

Check if 005 exists. If it does, skip. If not, create it with:
- `user_xp (user_id, total_xp, weekly_xp, level, updated_at)`
- `streaks (user_id, current_streak, longest_streak, last_active)`
- `badges (id, name, description, icon, unlock_condition, xp_required)`
- `user_badges (user_id, badge_id, earned_at)`

---

### Task 3: Database Migration 006 — Student Model (Theory of Mind)

**Files:** `supabase/migrations/006_student_model.sql`

```sql
-- Student belief model (Theory of Mind)
CREATE TABLE IF NOT EXISTS student_beliefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic text NOT NULL,
  belief_text text NOT NULL,
  confidence float DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  source_correction_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Error pattern tracking
CREATE TABLE IF NOT EXISTS error_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  error_type text NOT NULL,
  count integer DEFAULT 1,
  last_seen timestamptz DEFAULT now(),
  examples jsonb DEFAULT '[]'::jsonb,
  UNIQUE(user_id, error_type)
);

-- Learning state (CEFR + weak/strong areas)
CREATE TABLE IF NOT EXISTS learning_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cefr_estimate text DEFAULT 'A1',
  weak_areas text[] DEFAULT '{}',
  strong_areas text[] DEFAULT '{}',
  native_language text DEFAULT 'English',
  accuracy_last_10 float DEFAULT 0,
  total_corrections integer DEFAULT 0,
  last_updated timestamptz DEFAULT now()
);

-- Add native_language to profiles if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS native_language text DEFAULT 'English';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_student_beliefs_user ON student_beliefs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_patterns_user ON error_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_error_patterns_count ON error_patterns(user_id, count DESC);

-- RLS
ALTER TABLE student_beliefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own beliefs" ON student_beliefs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own error patterns" ON error_patterns
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own learning state" ON learning_state
  FOR ALL USING (auth.uid() = user_id);

-- Service role bypass for n8n/API
CREATE POLICY "Service role full access beliefs" ON student_beliefs
  FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access errors" ON error_patterns
  FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access learning" ON learning_state
  FOR ALL TO service_role USING (true);
```

---

### Task 4: Database Migration 007 — Subscriptions

**Files:** `supabase/migrations/007_subscriptions.sql`

```sql
-- Stripe products (synced from Stripe)
CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  active boolean,
  name text,
  description text,
  image text,
  metadata jsonb
);

-- Stripe prices (synced from Stripe)
CREATE TABLE IF NOT EXISTS prices (
  id text PRIMARY KEY,
  product_id text REFERENCES products(id),
  active boolean,
  currency text,
  interval text,
  interval_count integer,
  unit_amount bigint,
  type text,
  metadata jsonb
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'premium')),
  status text NOT NULL DEFAULT 'inactive',
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  price_id text REFERENCES prices(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Usage quotas (daily, reset at midnight UTC)
CREATE TABLE IF NOT EXISTS usage_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  text_corrections integer DEFAULT 0,
  audio_corrections integer DEFAULT 0,
  ocr_corrections integer DEFAULT 0,
  voice_minutes integer DEFAULT 0,
  reset_at timestamptz DEFAULT (NOW() + INTERVAL '1 day'),
  UNIQUE(user_id, date)
);

-- Stripe webhook idempotency
CREATE TABLE IF NOT EXISTS processed_stripe_events (
  event_id text PRIMARY KEY,
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

CREATE POLICY "Users read own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own quotas" ON usage_quotas
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can read products" ON products FOR SELECT USING (true);
CREATE POLICY "Anyone can read prices" ON prices FOR SELECT USING (true);

-- Service role full access
CREATE POLICY "Service role subscriptions" ON subscriptions FOR ALL TO service_role USING (true);
CREATE POLICY "Service role quotas" ON usage_quotas FOR ALL TO service_role USING (true);
CREATE POLICY "Service role products" ON products FOR ALL TO service_role USING (true);
CREATE POLICY "Service role prices" ON prices FOR ALL TO service_role USING (true);

-- SECURITY DEFINER function: check quota and increment
CREATE OR REPLACE FUNCTION check_and_increment_quota(
  p_user_id uuid,
  p_type text,
  p_limit integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current integer;
  v_tier text;
BEGIN
  -- Get current tier
  SELECT COALESCE(tier, 'free') INTO v_tier
  FROM subscriptions WHERE user_id = p_user_id;

  IF v_tier IS NULL THEN v_tier := 'free'; END IF;

  -- Upsert today's quota row
  INSERT INTO usage_quotas (user_id, date)
  VALUES (p_user_id, CURRENT_DATE)
  ON CONFLICT (user_id, date) DO NOTHING;

  -- Get current count
  EXECUTE format(
    'SELECT %I FROM usage_quotas WHERE user_id = $1 AND date = CURRENT_DATE',
    p_type || '_corrections'
  ) INTO v_current USING p_user_id;

  IF v_current IS NULL THEN v_current := 0; END IF;

  -- Check limit (-1 = unlimited)
  IF p_limit >= 0 AND v_current >= p_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'current', v_current,
      'limit', p_limit,
      'tier', v_tier
    );
  END IF;

  -- Increment
  EXECUTE format(
    'UPDATE usage_quotas SET %I = %I + 1 WHERE user_id = $1 AND date = CURRENT_DATE',
    p_type || '_corrections', p_type || '_corrections'
  ) USING p_user_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'current', v_current + 1,
    'limit', p_limit,
    'tier', v_tier
  );
END;
$$;
```

---

### Task 5: Database Migration 008 — Vocabulary (FSRS)

**Files:** `supabase/migrations/008_vocabulary.sql`

```sql
CREATE TABLE IF NOT EXISTS vocabulary_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  german_word text NOT NULL,
  english_translation text NOT NULL,
  example_sentence text,
  audio_url text,
  cefr_level text DEFAULT 'A1',
  topic_tags text[] DEFAULT '{}',
  source_correction_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS card_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES vocabulary_cards(id) ON DELETE CASCADE,
  -- FSRS algorithm fields
  stability float DEFAULT 1,
  difficulty float DEFAULT 5,
  due timestamptz DEFAULT now(),
  lapses integer DEFAULT 0,
  reps integer DEFAULT 0,
  state text DEFAULT 'new' CHECK (state IN ('new', 'learning', 'review', 'relearning')),
  last_review timestamptz,
  UNIQUE(user_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_vocab_cards_user ON vocabulary_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_card_reviews_user ON card_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_card_reviews_due ON card_reviews(user_id, due ASC);

ALTER TABLE vocabulary_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own vocab" ON vocabulary_cards FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own reviews" ON card_reviews FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service vocab" ON vocabulary_cards FOR ALL TO service_role USING (true);
CREATE POLICY "Service reviews" ON card_reviews FOR ALL TO service_role USING (true);
```

---

### Task 6: Database Migration 009 — WhatsApp

**Files:** `supabase/migrations/009_whatsapp.sql`

```sql
CREATE TABLE IF NOT EXISTS whatsapp_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  opted_in boolean DEFAULT false,
  preferred_time time DEFAULT '08:00',
  show_in_native_language boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own whatsapp" ON whatsapp_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service whatsapp" ON whatsapp_settings FOR ALL TO service_role USING (true);
```

---

### Task 7: L1 Profiles Data

**Files:** `src/data/l1-profiles.ts`

Create a comprehensive map of 25 native languages → pedagogical notes, challenges, and leverage points for learning German.

---

### Task 8: Student Model Library

**Files:** `src/lib/student-model.ts`

Two-pass reasoning: after every correction, extract error categories → update error_patterns → call GPT to infer student belief → store in student_beliefs → inject top 3 beliefs into next correction prompt.

Key function: `updateStudentModel(userId, correction)` — async, fire-and-forget from API route.

---

### Task 9: API Guard Middleware

**Files:** `src/lib/api-guard.ts`

HOF wrapper for Next.js route handlers:
```typescript
export function withApiGuard(handler, options: ApiGuardOptions)
```
Checks: JWT auth → rate limit → quota → then calls handler.

---

### Task 10: useGermanSpeech Hook

**Files:** `src/hooks/useGermanSpeech.ts`

Wraps react-speech-recognition:
- Language: de-DE
- Azure polyfill applied at module load
- Auto-submit after 2s silence (watch finalTranscript + empty interimTranscript)
- Use `abortListening` (NOT `stopListening`) with Azure + continuous

---

### Task 11: FSRS Flashcard Page

**Files:**
- `src/app/(protected)/flashcards/page.tsx`
- `src/app/api/flashcards/review/route.ts`

Uses ts-fsrs for scheduling. Card flip animation. 4 rating buttons (Again/Hard/Good/Easy). Audio pronunciation via Azure TTS.

---

### Task 12: Stripe Integration

**Files:**
- `src/app/api/stripe/checkout/route.ts`
- `src/app/api/stripe/webhook/route.ts`
- `src/app/api/stripe/portal/route.ts`
- `src/app/api/subscription/status/route.ts`
- `src/app/(protected)/pricing/page.tsx`

Stripe webhook verifies signature, syncs products/prices to Supabase, handles subscription lifecycle events.

---

### Task 13: Pronunciation Assessment

**Files:**
- `src/lib/pronunciation.ts`
- Update `src/components/tutor/AudioRecorder.tsx`

Azure Speech SDK PronunciationAssessmentConfig with Phoneme granularity. Returns per-word and per-phoneme scores. UI: word heatmap (green/yellow/red).

---

### Task 14: Voice Conversation Mode

**Files:**
- `src/app/(protected)/tutor/voice/page.tsx`
- `src/app/api/voice/token/route.ts`

OpenAI Realtime API via WebRTC. Ephemeral token (60s TTL). 8 scenario prompts.

---

### Task 15: German News Reader

**Files:**
- `src/app/(protected)/lesen/page.tsx`
- `src/app/api/news/german/route.ts`

Deutsche Welle RSS → simplify to CEFR level → tap-to-translate → auto-add to flashcards.

---

### Task 16: WhatsApp Bot (n8n workflow)

**Files:** `n8n-workflows/morodeutsch-whatsapp-daily.json`
`src/app/api/webhooks/whatsapp/route.ts`

---

### Task 17: PWA + Performance

**Files:**
- `public/manifest.json`
- `next.config.ts` (PWA config)

---

## Environment Variables Checklist

Add to `.env.local`:
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_PREMIUM_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=swedencentral
WHATSAPP_TOKEN=...
WHATSAPP_VERIFY_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
OPENAI_API_KEY=...
ENABLE_VOICE_MODE=true
ENABLE_WHATSAPP_BOT=true
ENABLE_STRIPE=true
```
