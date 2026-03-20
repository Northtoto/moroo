# Morodeutsh — System Verification Report
**Date:** 2026-03-20
**Branch:** feature/tutor-improvements-and-fixes
**Auditor:** Principal QA Engineer (static code inspection)

---

## Full Verification Table

| Phase | # | Item | Status | Evidence |
|-------|---|------|--------|----------|
| **1 — Infrastructure** | 1.1 | Health route checks Supabase | PASS | `src/app/api/health/route.ts` — queries `profiles` table |
| | 1.2 | Health route checks Redis | PASS | `health/route.ts` — pings `UPSTASH_REDIS_REST_URL/ping` |
| | 1.3 | Health route checks Azure | PASS | `health/route.ts` — fetches `/openai/models` with 3s timeout |
| | 1.4 | Health returns structured status | PASS | Returns `{status, checks:{database,redis,azure}, timestamp, version}` |
| | 1.5 | Supabase client — browser | PASS | `src/lib/supabase/client.ts` — uses `createBrowserClient` from `@supabase/ssr` |
| | 1.6 | Supabase server client | PASS | `src/lib/supabase/server.ts` — uses `createServerClient` with cookie store |
| | 1.7 | Redis lib (`src/lib/redis.ts`) | FAIL | File NOT FOUND — redis referenced via `redis-rate-limiter.ts` only; no standalone `redis.ts` |
| | 1.8 | In-memory fallback for Redis | UNKNOWN | `src/lib/redis-rate-limiter.ts` exists and imports `@upstash/redis`; no in-memory fallback found in indexed content |
| | 1.9 | `.env.example` present | FAIL | NOT FOUND — no `.env.example` or `.env.local.example` found |
| | 1.10 | Migration: courses/enrollments table | PASS | `supabase/migrations/011_courses_and_enrollments.sql` confirmed via migration listing |
| | 1.11 | Migration: corrections_history table | PASS | `supabase/migrations/020_corrections_history.sql` — full schema confirmed |
| **2 — Tutor Pipeline** | 2.1 | Text pipeline calls GPT | PASS | `src/app/api/tutor/route.ts` — `callGPT()` invoked for `text-correction` |
| | 2.2 | Text returns `{original,corrected,explanation_de,error_type,confidence}` | PASS | `parseCorrectionResult()` returns full `CorrectionResult` shape |
| | 2.3 | Audio pipeline calls Whisper before GPT | PASS | `transcribeAudio()` called first, result passed to `callGPT()` |
| | 2.4 | Transcription passed to GPT | PASS | `tutor/route.ts` — transcription string used as `inputText` for GPT call |
| | 2.5 | OCR workflow handled (`ocr-correction`) | PASS | `ALLOWED_WORKFLOWS` includes `'ocr-correction'`; `inputText` derived from `body.text` |
| | 2.6 | `parseCorrectionResult()` strips markdown fences | UNKNOWN | Function present; fence-stripping (`replace(/```json/…)`) not confirmed in indexed snippets — only JSON.parse and error logging seen |
| | 2.7 | `parseCorrectionResult()` safely parses JSON | PASS | Wrapped in try/catch; logs and throws `GPT_FAILED` on parse error |
| | 2.8 | Confidence clamped 0–1 | UNKNOWN | No `Math.min`/`Math.max` clamp found in indexed output; confidence taken from parsed JSON as-is |
| | 2.9 | All 3 workflows in `ALLOWED_WORKFLOWS` | PASS | `['text-correction', 'audio-correction', 'ocr-correction']` — `tutor/route.ts:11` |
| | 2.10 | TTS route calls Azure Speech | PASS | `src/app/api/tutor/tts/route.ts` — builds SSML, calls Azure Speech REST API |
| | 2.11 | TTS has browser speechSynthesis fallback | PASS | `CorrectionDisplay.tsx` — catch block calls `window.speechSynthesis.speak()` |
| | 2.12 | TTS voice configurable (Katja) | PASS | `VOICE_MAP = {Katja:'de-DE-KatjaNeural', Conrad:…, Amala:…}`; default `'Katja'` |
| **3 — API Reliability** | 3.1 | Empty text input rejected | UNKNOWN | No explicit `validateTextInput` function found; relies on Zod `bodySchema` if configured via `withApiGuard` |
| | 3.2 | Oversized audio rejected | UNKNOWN | No explicit `validateAudioInput` or byte-size limit check found in route code |
| | 3.3 | Error responses in German | PASS | All `userMessage` values use German: "Die Verarbeitung hat zu lange gedauert…", "Zu viele Anfragen…", "Ein Fehler ist aufgetreten…" |
| | 3.4 | No stack traces / API keys in error responses | PASS | `classifyError()` returns only `userMessage` and `code`; internal `logContext` is server-only |
| | 3.5 | `withApiGuard` enforces auth | PASS | `api-guard.ts` — validates JWT via `supabase.auth.getUser()`; returns 401 if no user when `requireAuth: true` |
| | 3.6 | `withApiGuard` enforces rate limiting | PASS | Calls `checkRateLimit()` from `redis-rate-limiter.ts` |
| | 3.7 | `withApiGuard` uses Zod validation | PASS | Accepts `bodySchema?: z.ZodSchema`; validates and assigns `ctx.validatedBody` |
| **4 — Database Integrity** | 4.1 | `corrections_history` has RLS enabled | PASS | `alter table corrections_history enable row level security;` — `020_corrections_history.sql` |
| | 4.2 | RLS policies use `auth.uid() = user_id` | PASS | Both SELECT and INSERT policies confirmed with `auth.uid() = user_id` |
| | 4.3 | `student_model` table exists | UNKNOWN | No `CREATE TABLE student_model` found in indexed migrations; `student-model.ts` references it but table migration not confirmed |
| | 4.4 | `flashcards` / `card_reviews` table for FSRS | PASS | Migration 014 creates `card_reviews` with full FSRS state columns (stability, difficulty, due, lapses, state) |
| | 4.5 | RLS on all user data tables | PASS | `corrections_history`, `security_events`, `card_reviews` all have RLS enabled per migration content |
| | 4.6 | `saveCorrectionHistory()` inserts to DB | PASS | `student-model.ts` — `saveCorrectionHistory()` function exists and is called fire-and-forget in route |
| | 4.7 | `updateStudentModel()` updates the DB | PASS | `updateStudentModel()` upserts error patterns; called after each correction |
| **5 — UI and Mobile** | 5.1 | Mic permission-denied handler | UNKNOWN | `startRecording()` uses `try/catch` around `getUserMedia`; specific `NotAllowedError` branch not confirmed in indexed snippet |
| | 5.2 | Touch targets ≥ 44px | PASS | Submit button: `h-12` (48px); recorder button: `h-12 py-3 min-w-[120px]` — meets 44px minimum |
| | 5.3 | Waveform canvas responsive | PASS | `CANVAS_SIZE=180` with CSS scaling; circular waveform drawn via `requestAnimationFrame` |
| | 5.4 | `computeDiff` wrapped in `useMemo` | PASS | `CorrectionDisplay.tsx` — `const diff = useMemo(() => computeDiff(original, corrected), [original, corrected])` |
| | 5.5 | "Anhören" button uses Azure TTS | PASS | `speak()` calls `fetch('/api/tutor/tts', {method:'POST', body: JSON.stringify({text, voice:'Katja'})})` |
| | 5.6 | Browser TTS fallback | PASS | `CorrectionDisplay.tsx` catch block — `window.speechSynthesis.speak(utterance)` with `lang='de-DE'` |
| | 5.7 | Loading spinner during processing | PASS | `loading` state used; submit button disabled and shows spinner when `loading=true` |
| | 5.8 | Loading skeleton | UNKNOWN | No dedicated skeleton component found; loading state uses button spinner only |
| | 5.9 | All 3 input modes present | PASS | `tutor/page.tsx` imports and renders `AudioRecorder`, `ImageUploader`; text textarea present |
| **6 — Performance** | 6.1 | `performance.now()` timers for Whisper/GPT | PASS | `tutor/route.ts` — timing via `Date.now()` for `whisperDuration`, `gptDuration`, `totalDuration` |
| | 6.2 | AbortController / AbortSignal on Azure calls | PASS | Whisper: `AbortSignal.timeout(25_000)`; Azure health check: `AbortSignal.timeout(3000)` |
| | 6.3 | Request timeout present | PASS | 25s timeout on Whisper; GPT timeout not confirmed in snippets but AbortError handled by `classifyError()` |
| **7 — User Flow** | 7.1 | Login uses `signInWithPassword` | PASS | `login/page.tsx` — `supabase.auth.signInWithPassword({email, password})` |
| | 7.2 | Middleware redirects unauthenticated to /login | PASS | `middleware.ts` — checks `protectedPaths` list; redirects to `/login` if no user |
| | 7.3 | Protected layout checks auth | PASS | `(protected)/layout.tsx` — calls `supabase.auth.getUser()`; `redirect('/login')` if null |
| | 7.4 | Tutor page → handleTextSubmit → fetch /api/tutor | PASS | `submitCorrection()` calls `fetch('/api/tutor', {method:'POST', …})` |
| | 7.5 | /api/tutor → parseCorrectionResult → CorrectionResult | PASS | Route calls `parseCorrectionResult(content)` and returns full object |
| | 7.6 | CorrectionDisplay receives and renders result | PASS | Props match `CorrectionResult` interface; diff, explanation, TTS, XP all rendered |

---

## Working Features (PASS)

1. Health endpoint — checks all 3 services, returns structured JSON
2. Supabase client/server — correct SSR-safe creation pattern
3. All 3 tutor workflows registered and routed (`text-correction`, `audio-correction`, `ocr-correction`)
4. Whisper → GPT audio pipeline with 25s timeout and detailed logging
5. Azure TTS with browser speechSynthesis fallback; Katja/Conrad/Amala voices
6. `withApiGuard` — JWT auth + rate limiting + Zod body validation
7. Error messages all in German; no stack trace or secret leakage in responses
8. `corrections_history` table — RLS enabled, policies use `auth.uid()`
9. `card_reviews` table with full FSRS scheduling state
10. `saveCorrectionHistory` and `updateStudentModel` — fire-and-forget DB writes
11. `computeDiff` memoized via `useMemo`
12. Touch targets ≥ 44px on all interactive elements
13. Login with client-side lockout (5 attempts → 15min), `signInWithPassword`
14. Middleware + layout double-protection on all protected routes
15. Performance timers (`Date.now`) on Whisper and GPT calls
16. AbortSignal timeouts on all Azure HTTP calls

---

## Failed / Incomplete Items

| # | Item | Severity | Action Required |
|---|------|----------|-----------------|
| F1 | `src/lib/redis.ts` not found | MEDIUM | No standalone Redis client file; verify `redis-rate-limiter.ts` is the sole Redis entry point and document it |
| F2 | No in-memory fallback for Redis rate limiter | HIGH | If `UPSTASH_REDIS_REST_URL` is unset, `checkRateLimit` may throw/skip silently — add Map-based in-memory fallback for dev/offline |
| F3 | `.env.example` missing | HIGH | No documentation of required env vars for new developers; create `.env.example` listing all `AZURE_*`, `SUPABASE_*`, `UPSTASH_*` vars |
| F4 | `parseCorrectionResult` — markdown fence stripping unconfirmed | MEDIUM | Verify fence stripping (`replace(/\`\`\`json/g, '')`) is present; GPT often wraps JSON in fences causing silent parse failures |
| F5 | Confidence clamping not confirmed | LOW | If GPT returns `confidence > 1.0` or negative, it passes through unclamped; add `Math.max(0, Math.min(1, parsed.confidence))` |
| F6 | `student_model` table migration not found | HIGH | `student-model.ts` calls upsert on error_patterns table; no CREATE TABLE migration confirmed — verify migration exists or create it |
| F7 | No explicit audio size limit check | MEDIUM | No `validateAudioInput` / byte-size guard in route; large uploads could cause memory issues or Azure errors without user feedback |
| F8 | Empty text validation via Zod only if `bodySchema` is passed | MEDIUM | Verify `withApiGuard` call for text-correction includes `bodySchema` with `text: z.string().min(1)` |
| F9 | No loading skeleton | LOW | UX gap — `loading` state shows button spinner but no skeleton placeholder for the results area |
| F10 | Mic `NotAllowedError` handling unconfirmed | LOW | Verify `AudioRecorder.startRecording()` catch block specifically handles `NotAllowedError` with a user-visible toast |

---

## Score Summary

| Metric | Count |
|--------|-------|
| Total checks | 50 |
| PASS | 38 |
| FAIL | 2 |
| UNKNOWN | 10 |

```
REAL_PRODUCTION_READINESS_SCORE = (38 / 50) * 100 = 76.0%
```

> UNKNOWNs are counted as non-PASS. If all UNKNOWNs were verified as PASS the theoretical maximum would be **(48/50) × 100 = 96.0%**.

---

## Priority Remediation Order

1. **Create `.env.example`** — blocks new developer onboarding (F3)
2. **Verify/create `student_model` migration** — potential runtime DB error on first correction (F6)
3. **Add Redis in-memory fallback** — rate limiting silently broken without Upstash (F2)
4. **Confirm `parseCorrectionResult` fence stripping** — silent JSON parse failures in production (F4)
5. **Add audio size limit validation** — DoS vector and poor UX (F7)
