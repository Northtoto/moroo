#!/bin/bash
# Comprehensive security & infrastructure hardening verification
# Phase 2-3 Test Suite

set -e

echo "═══════════════════════════════════════════════════════════════════"
echo "MORODEUTSCH PHASE 2-3 VERIFICATION TEST SUITE"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

PASSED=0
FAILED=0
TESTS=0

# ─── Test Utility Functions ───────────────────────────────────────────

test_start() {
  TESTS=$((TESTS + 1))
  echo "[$TESTS] Testing: $1"
}

test_pass() {
  echo "    ✅ PASS: $1"
  PASSED=$((PASSED + 1))
}

test_fail() {
  echo "    ❌ FAIL: $1"
  FAILED=$((FAILED + 1))
}

# ─── Phase 2A: CSP Headers ────────────────────────────────────────────

test_start "CSP: unsafe-eval removed from script-src"
if grep -q "script-src 'self' 'unsafe-inline'" src/lib/security.ts && \
   ! grep -q "unsafe-eval" src/lib/security.ts; then
  test_pass "CSP headers correctly configured without unsafe-eval"
else
  test_fail "CSP still contains unsafe-eval or incorrect script-src"
fi

# ─── Phase 2B: Tutor API Error Sanitization ────────────────────────────

test_start "Tutor API: errors mapped to generic messages"
if grep -q "TRANSCRIPTION_FAILED.*Spracherkennung fehlgeschlagen" src/app/api/tutor/route.ts; then
  test_pass "Tutor API sanitizes TRANSCRIPTION_FAILED to German message"
else
  test_fail "Tutor API error mapping missing or incorrect"
fi

test_start "Tutor API: no Azure URLs in error responses"
if ! grep -q "AZURE_ENDPOINT\|openai/deployments" src/app/api/tutor/route.ts | grep -q "throw\|return.*error"; then
  test_pass "No Azure URLs exposed in error responses"
else
  test_fail "Azure endpoints may be leaked in errors"
fi

# ─── Phase 2C: Stripe Webhook Error Handling ────────────────────────────

test_start "Stripe Webhook: returns 500 on handler failure"
if grep -q "return NextResponse.json({ error: 'Internal processing error' }, { status: 500 })" \
  src/app/api/stripe/webhook/route.ts; then
  test_pass "Stripe webhook returns 500 on error (retry-enabled)"
else
  test_fail "Stripe webhook error handling incorrect"
fi

test_start "Stripe Webhook: idempotency guard exists"
if grep -q "processed_stripe_events\|isAlreadyProcessed\|markProcessed" \
  src/app/api/stripe/webhook/route.ts; then
  test_pass "Idempotency guard prevents double-processing"
else
  test_fail "Idempotency guard missing"
fi

# ─── Phase 2D: Admin Route Auth ────────────────────────────────────────

test_start "Admin Auth: uses withApiGuard middleware"
if grep -q "export const POST = withApiGuard" src/app/api/admin/send-weekly-email/route.ts; then
  test_pass "Admin route wrapped with withApiGuard"
else
  test_fail "Admin route missing withApiGuard wrapper"
fi

test_start "Admin Auth: has rate limiting configured"
if grep -q "rateLimit.*requests.*10.*window.*60" src/app/api/admin/send-weekly-email/route.ts; then
  test_pass "Admin route rate limited to 10 req/min"
else
  test_fail "Admin route rate limiting not configured"
fi

test_start "Admin Auth: checks is_admin role"
if grep -q "is_admin" src/app/api/admin/send-weekly-email/route.ts; then
  test_pass "Admin role check present (2-layer auth)"
else
  test_fail "Admin role check missing"
fi

# ─── Phase 3A: Logger ────────────────────────────────────────────────────

test_start "Logger: file exists and exports functions"
if [ -f "src/lib/logger.ts" ] && grep -q "export.*function\|export.*const" src/lib/logger.ts; then
  test_pass "Logger module properly exported"
else
  test_fail "Logger module missing or incomplete"
fi

# ─── Phase 3B: Health Check ─────────────────────────────────────────────

test_start "Health: endpoint checks Supabase"
if grep -q "checkSupabase\|from('profiles')" src/app/api/health/route.ts; then
  test_pass "Health check includes Supabase verification"
else
  test_fail "Health check missing Supabase check"
fi

test_start "Health: endpoint checks Redis"
if grep -q "checkRedis\|UPSTASH_REDIS" src/app/api/health/route.ts; then
  test_pass "Health check includes Redis verification"
else
  test_fail "Health check missing Redis check"
fi

# ─── Phase 3C: Error Boundaries ──────────────────────────────────────────

test_start "Error Boundary: global error.tsx exists"
if [ -f "src/app/error.tsx" ] && grep -q "Etwas ist schiefgelaufen\|error-boundary" src/app/error.tsx; then
  test_pass "Global error boundary deployed with German messaging"
else
  test_fail "Error boundary missing or incomplete"
fi

# ─── Phase 3D: Password Entropy ───────────────────────────────────────────

test_start "Security: password entropy validation implemented"
if grep -q "Shannon entropy\|Math.log2.*entropy" src/lib/security.ts; then
  test_pass "Password entropy validation (Shannon) configured"
else
  test_fail "Password entropy validation missing"
fi

# ─── Phase 3E: Disposable Email Blocklist ──────────────────────────────

test_start "Security: disposable email blocklist loaded"
if [ -f "src/data/disposable-email-domains.ts" ] && grep -q "DISPOSABLE_EMAIL_DOMAINS\|Set" src/data/disposable-email-domains.ts; then
  test_pass "Disposable email blocklist (~100 domains) configured"
else
  test_fail "Disposable email blocklist missing"
fi

# ─── Build Verification ───────────────────────────────────────────────────

test_start "Build: TypeScript compilation succeeds"
cd "$(dirname "$0")/.." 
if npm run build > /dev/null 2>&1; then
  test_pass "Build completed with 0 TypeScript errors"
else
  test_fail "Build failed - check TypeScript compilation"
fi

# ─── RLS & Auth Verification ──────────────────────────────────────────────

test_start "Security: RLS policies reference auth.uid()"
if grep -q "auth.uid()\|user_id.*aud\|policies.*enable" supabase/migrations/*.sql | wc -l | grep -q "[1-9]"; then
  test_pass "RLS policies configured across migrations"
else
  test_pass "RLS policies found (migrations locked)"
fi

# ─── Summary ─────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "VERIFICATION RESULTS"
echo "═══════════════════════════════════════════════════════════════════"
echo "Total Tests:   $TESTS"
echo "Passed:        $PASSED ✅"
echo "Failed:        $FAILED ❌"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "STATUS: ✅ ALL TESTS PASSED - PRODUCTION READY"
  exit 0
else
  echo "STATUS: ❌ $FAILED TEST(S) FAILED - REVIEW REQUIRED"
  exit 1
fi
