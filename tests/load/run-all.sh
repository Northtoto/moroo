#!/usr/bin/env bash
# ─── Morodeutsch Load Test Runner ─────────────────────────────────────────────
# Runs all k6 test suites and collects results in reports/
#
# Prerequisites:
#   1. k6 installed: https://k6.io/docs/get-started/installation/
#   2. Dev server running: npm run dev (or production URL)
#   3. Valid JWT in K6_AUTH_TOKEN env var
#
# How to get a test JWT:
#   npx supabase gen token --email test@morodeutsch.com --password <pass>
#   OR extract from browser DevTools → Application → Local Storage → sb-*-auth-token
#
# Usage:
#   export K6_AUTH_TOKEN="eyJ..."
#   export BASE_URL="http://localhost:3000"   # or https://morodeutsch.com
#   bash tests/load/run-all.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
TOKEN="${K6_AUTH_TOKEN:-}"
REPORTS_DIR="reports"

# ── Preflight ──────────────────────────────────────────────────────────────────
if ! command -v k6 &>/dev/null; then
  echo "❌ k6 not found. Install from https://k6.io/docs/get-started/installation/"
  exit 1
fi

if [[ -z "$TOKEN" ]]; then
  echo "⚠️  K6_AUTH_TOKEN not set. Requests will return 401. Rate-limiter test skipped."
fi

mkdir -p "$REPORTS_DIR"

echo "═══════════════════════════════════════════════"
echo "  Morodeutsch Load Test Suite"
echo "  Target: $BASE_URL"
echo "═══════════════════════════════════════════════"

# ── 1. Text Correction (20 VUs × 60s) ─────────────────────────────────────────
echo ""
echo "▶ Test 1/4 — Text Correction (20 VUs)"
k6 run \
  --env BASE_URL="$BASE_URL" \
  --env K6_AUTH_TOKEN="$TOKEN" \
  --out json="$REPORTS_DIR/load-text-raw.json" \
  tests/load/text-correction.js
echo "✓ Text correction complete"

# ── 2. Audio Submission (10 VUs × 120s) ───────────────────────────────────────
echo ""
echo "▶ Test 2/4 — Audio Submission (10 VUs, Whisper pipeline)"
k6 run \
  --env BASE_URL="$BASE_URL" \
  --env K6_AUTH_TOKEN="$TOKEN" \
  --out json="$REPORTS_DIR/load-audio-raw.json" \
  tests/load/audio-submission.js
echo "✓ Audio submission complete"

# ── 3. OCR Burst (30 VUs ramp) ────────────────────────────────────────────────
echo ""
echo "▶ Test 3/4 — OCR Burst (0→30→0 VUs)"
k6 run \
  --env BASE_URL="$BASE_URL" \
  --env K6_AUTH_TOKEN="$TOKEN" \
  --out json="$REPORTS_DIR/load-ocr-raw.json" \
  tests/load/ocr-burst.js
echo "✓ OCR burst complete"

# ── 4. Rate Limiter (single user, 70 rapid requests) ──────────────────────────
if [[ -n "$TOKEN" ]]; then
  echo ""
  echo "▶ Test 4/4 — Rate Limiter Verification (70 rapid requests)"
  k6 run \
    --env BASE_URL="$BASE_URL" \
    --env K6_AUTH_TOKEN="$TOKEN" \
    tests/load/rate-limiter.js
  echo "✓ Rate limiter test complete"
else
  echo "⏭  Test 4/4 — Rate Limiter skipped (no auth token)"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  All tests complete. Reports saved to: $REPORTS_DIR/"
echo "  Run 'node tests/load/generate-report.js' to compile final report"
echo "═══════════════════════════════════════════════"
