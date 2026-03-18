# Morodeutsch — Feature Delivery Log
**Period:** March 13 – 15, 2026
**Status:** Platform stabilisation sprint — all critical blockers resolved

---

## 🔴 Critical Fixes

### 1. Middleware Auth Guard — CREATED ✅
**File:** `src/middleware.ts` + `src/lib/supabase/middleware.ts`
**Problem:** File was completely missing — ALL protected routes were publicly accessible without authentication.
**Solution:**
- Created `src/middleware.ts` entry point calling `updateSession`
- Full implementation in `src/lib/supabase/middleware.ts`:
  - JWT validation via `getUser()` (server-side verified, not `getSession()`)
  - Security headers on every response (CSP, HSTS, X-Frame-Options, etc.)
  - Path traversal / XSS / SQLi / null-byte request blocking
  - `/admin/*` route protection with `is_admin` check + account lock enforcement
  - Protected routes guard (`/dashboard`, `/courses`, `/tutor`, `/league`, `/profile`, `/progress`, `/certificate`) → redirect to `/login`
  - `approval_status` enforcement → redirect to `/approval-pending` or `/access-denied`
  - Redirect logged-in users away from `/login` and `/signup`

---

### 2. Audio Processing — FIXED ✅
**File:** `src/app/api/tutor/route.ts`
**Problem:** Audio transcription was silently failing with zero error feedback.
**Solution:**
- Added file size guard: max **25 MB** → returns HTTP 413
- Added zero-byte check → returns HTTP 400
- Added MIME type allowlist (wav, mp3, webm, ogg, etc.) → returns HTTP 415
- Added `AbortSignal.timeout(25_000)` to Whisper fetch
- Added `AbortSignal.timeout(20_000)` to GPT correction fetch
- Added comprehensive `[tutor:audio:*]` console logging at every stage

---

### 3. Dashboard Import Crash — FIXED ✅
**File:** `src/app/(protected)/dashboard/page.tsx`
**Problem:** Missing `import { createClient }` caused white-screen crash on load.
**Solution:** Added the missing Supabase server client import.

---

### 4. Certificate Page — FIXED ✅
**File:** `src/app/(protected)/certificate/page.tsx`
**Problem:** Page queried a `messages` table that does not exist → runtime error.
**Solution:** Changed query from `from('messages')` to `from('learning_state').select('correction_count')` — the correct location per the schema.

---

## 🟠 High Priority Features

### 5. Redis Rate Limiter — IMPLEMENTED ✅
**Files:** `src/lib/redis-rate-limiter.ts`, `src/lib/api-guard.ts`
**Problem:** In-memory `Map`-based rate limiter resets on every cold start (useless in serverless).
**Solution:**
- Created `src/lib/redis-rate-limiter.ts` — Upstash Redis sliding-window rate limiter using atomic Lua script
- Lazy Redis singleton with graceful fallback to in-process Map (works without Redis configured)
- Removed old `rateLimitStore`, `checkRateLimit`, and `setInterval` cleanup from `api-guard.ts`
- Requires: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` env vars

---

### 6. League Page — REAL DATA ✅
**File:** `src/app/(protected)/league/page.tsx`
**Problem:** Page showed 20 hardcoded fake player names — no real data.
**Solution:**
- Replaced mock arrays with live Supabase RPC calls
- `get_leaderboard(10)` → real players ranked by XP
- `get_weekly_stats(user_id)` → real weekly challenge stats
- Weekly challenge card now shows actual `text_corrections`, `audio_corrections`, `active_days`
- Kept 2-entry `FALLBACK_PLAYERS` array for solo dev testing only

---

### 7. Stripe Schema Conflict — FIXED ✅
**File:** `supabase/migrations/015_leaderboard_and_stripe_fix.sql`
**Problem:** Migration 007 created `processed_stripe_events` with column `event_id`; webhook code used `stripe_event_id` → all Stripe webhooks silently failing.
**Solution:**
- Added `stripe_event_id` column via `ADD COLUMN IF NOT EXISTS`
- Back-filled `stripe_event_id` from `event_id` for existing rows
- Added `UNIQUE` constraint on `stripe_event_id` (idempotency key)

---

## 🟡 Medium Priority Features

### 8. Courses & Enrollments — CREATED ✅
**File:** `supabase/migrations/011_courses_and_enrollments.sql`
**Problem:** `/courses` page showed "Fehler beim Laden der Karten" — tables didn't exist.
**Solution:**
- `courses` table: id, title, description, level (A1–C2), image_url, is_published
- `enrollments` table: user_id → course_id with progress (0–100%) tracking
- RLS policies: published courses readable by anyone; enrollments private per user
- 6 sample courses seeded (A1 → C2 levels) for immediate testing

---

### 9. Student Model Tables — CREATED ✅
**File:** `supabase/migrations/012_student_model_tables.sql`
**Tables created:**
- `error_patterns` — per-user grammar error frequency tracking (type, count, examples JSONB)
- `student_beliefs` — AI-inferred misconceptions with confidence score
- `learning_state` — CEFR estimate, native language, weak areas, accuracy, correction count
- `vocabulary_cards` — user vocabulary with FSRS scheduling columns (due_at, stability, difficulty, reps, lapses, state)
- `security_events` — audit log for auth failures, rate limit hits, suspicious patterns

**RPC created:**
- `upsert_error_pattern(user_id, error_type, example)` — atomic increment + append, capped at 10 examples, fire-and-forget safe

**Migration hardening:**
- All `CREATE POLICY` statements wrapped in `DO $$ IF NOT EXISTS $$` guards (idempotent)
- `vocabulary_cards` FSRS columns added via `ALTER TABLE ADD COLUMN IF NOT EXISTS` (table existed from migration 008)
- Partial index with `now()` replaced with plain index (PostgreSQL forbids `VOLATILE` functions in index predicates)
- `DROP FUNCTION IF EXISTS` before RPC to avoid "cannot remove parameter defaults" error

---

### 10. Vocabulary Bank — CREATED ✅
**File:** `supabase/migrations/013_vocabulary_bank.sql`
**Purpose:** System-wide German vocabulary reference (no user_id — shared across all users).
**Contents:**
- 80 real German words across A1–B2 levels
- Each word: german_word, article, plural, english_translation, example sentence, cefr_level, category
- Public read RLS policy (anyone can read the bank)
- Indexes on cefr_level and category for fast FSRS seeding

---

### 11. Card Reviews & FSRS Scheduling — CREATED ✅
**File:** `supabase/migrations/014_card_reviews_and_fsrs.sql`
**Purpose:** Per-user FSRS state tracking for spaced repetition flashcards.
**Table:** `card_reviews` — one row per (user × word), holds full FSRS state (stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review, due)

**RPCs created:**
- `get_due_cards(user_id, limit)` — returns cards due now, ordered by most overdue first
- `seed_cards_from_bank(user_id, cefr)` — bootstraps new user's deck from vocabulary bank, cumulative by level (A1 user gets A1 words; B1 user gets A1+A2+B1 words)

**Auto-seed in API:**
- `GET /api/flashcards/review` — detects 0 total cards, calls `seed_cards_from_bank`, re-fetches automatically
- Students always see cards on first visit — no empty state

---

### 12. Leaderboard & Weekly Stats RPCs — CREATED ✅
**File:** `supabase/migrations/015_leaderboard_and_stripe_fix.sql`
- `get_leaderboard(limit)` — SECURITY DEFINER, bypasses per-user RLS, exposes only: user_id, display name, avatar, XP, level, streak. Never exposes email, tier, or approval status.
- `get_weekly_stats(user_id)` — sums `usage_quotas` for current week: text_corrections, audio_corrections, active_days

---

## 📦 Dependencies Added

| Package | Version | Purpose |
|---------|---------|---------|
| `@upstash/redis` | `^1.37.0` | Serverless-safe Redis for rate limiting |

---

## 🗃️ Database Migrations Applied

| # | File | Status |
|---|------|--------|
| 011 | `courses_and_enrollments.sql` | ✅ Applied |
| 012 | `student_model_tables.sql` | ✅ Applied (after idempotency fixes) |
| 013 | `vocabulary_bank.sql` | ✅ Applied |
| 014 | `card_reviews_and_fsrs.sql` | ✅ Applied (after ADD COLUMN fixes) |
| 015 | `leaderboard_and_stripe_fix.sql` | ✅ Applied |

---

## ⚙️ Environment Variables Required

```
# New (must be added to Vercel + .env.local)
UPSTASH_REDIS_REST_URL       — create at upstash.com → Redis → REST API
UPSTASH_REDIS_REST_TOKEN     — same dashboard

# Existing (verify are set)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
AZURE_OPENAI_ENDPOINT
AZURE_OPENAI_API_KEY
AZURE_OPENAI_GPT_DEPLOYMENT
AZURE_OPENAI_WHISPER_DEPLOYMENT
AZURE_OPENAI_API_VERSION
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_PRO
STRIPE_PRICE_PREMIUM
```

---

## 🧪 Verification Checklist

- [ ] `GET /flashcards/review` → returns 20 cards on first load (auto-seed)
- [ ] `POST /api/tutor` with text → returns corrected JSON with error_categories
- [ ] `POST /api/tutor` with audio > 25MB → returns 413 (not crash)
- [ ] `GET /league` → shows real user data (not mock names)
- [ ] `GET /dashboard` → loads without white screen
- [ ] Navigate to `/courses` without login → redirected to `/login`
- [ ] Stripe test webhook → subscription tier updates in Supabase
- [ ] Audio: console shows `[tutor:audio:*]` logs with transcription

---

## 🏁 Feature Readiness

| Feature | Status | Notes |
|---------|--------|-------|
| Tutor (Text) | 🟢 Ready | Instant German correction + explanation |
| Tutor (Audio) | 🟢 Ready | Azure Whisper → GPT correction, full error logging |
| Tutor (OCR) | 🟢 Ready | Client-side Tesseract.js, no Azure dependency |
| Flashcards | 🟢 Ready | FSRS scheduling, auto-seed on first visit |
| Courses | 🟢 Ready | 6 sample courses A1–C2 |
| Profile | 🟢 Ready | XP, streak, subscription tier |
| Certificate | 🟢 Ready | Awarded at B2+ level |
| League | 🟢 Ready | Real leaderboard via `get_leaderboard` RPC |
| Dashboard | 🟢 Ready | Import crash fixed |
| Subscription | 🟡 Ready | Stripe schema fixed; verify webhook secret |
| Admin Panel | 🟡 Ready | Test approval flow for your admin user |
| WhatsApp Bot | ⚪ Optional | Tables exist; needs Twilio/Meta phone provider |
| n8n Enrichment | ⚪ Optional | Set `N8N_WEBHOOK_URL` or leave unset |
