#!/usr/bin/env node
/**
 * Generates reports/load-test-results.md from k6 JSON summaries.
 * Run after tests/load/run-all.sh completes.
 *
 *   node tests/load/generate-report.js
 */

const fs   = require('fs');
const path = require('path');

const REPORTS = path.join(__dirname, '../../reports');

function loadSummary(file) {
  const p = path.join(REPORTS, file);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function p(metrics, name, percentile) {
  const m = metrics?.[name];
  if (!m) return 'N/A';
  const v = m.values?.['p(95)'] ?? m.values?.avg ?? m.values?.rate ?? m.values?.count;
  return v != null ? Math.round(v) : 'N/A';
}

function pct(metrics, name) {
  const m = metrics?.[name];
  if (!m) return 'N/A';
  const v = m.values?.rate;
  return v != null ? (v * 100).toFixed(1) + '%' : 'N/A';
}

function cnt(metrics, name) {
  const m = metrics?.[name];
  if (!m) return '0';
  return (m.values?.count ?? 0).toString();
}

const text  = loadSummary('load-text-summary.json');
const audio = loadSummary('load-audio-summary.json');
const ocr   = loadSummary('load-ocr-summary.json');
const rl    = loadSummary('load-ratelimit-summary.json');

const now = new Date().toISOString();

const THRESHOLD_TEXT_P95  = 3000;
const THRESHOLD_AUDIO_P95 = 20000;
const THRESHOLD_OCR_P95   = 5000;
const THRESHOLD_ERR_RATE  = 0.03;

function status(value, threshold, lower_is_better = true) {
  if (value === 'N/A') return '⚠️';
  const num = parseFloat(value);
  return lower_is_better ? (num <= threshold ? '✅' : '❌') : (num >= threshold ? '✅' : '❌');
}

const textP95   = text  ? Math.round(text.metrics?.correction_latency_ms?.values?.['p(95)'] ?? 9999) : 'N/A';
const audioP95  = audio ? Math.round(audio.metrics?.audio_latency_ms?.values?.['p(95)'] ?? 99999) : 'N/A';
const ocrP95    = ocr   ? Math.round(ocr.metrics?.ocr_correction_latency_ms?.values?.['p(95)'] ?? 9999) : 'N/A';
const textErr   = text  ? (text.metrics?.correction_error_rate?.values?.rate ?? 1) : 'N/A';
const audioErr  = audio ? (audio.metrics?.audio_error_rate?.values?.rate ?? 1) : 'N/A';
const ocrErr    = ocr   ? (ocr.metrics?.ocr_error_rate?.values?.rate ?? 1) : 'N/A';

const rlAllowed = rl ? cnt(rl.metrics, 'rl_allowed') : 'N/A';
const rlBlocked = rl ? cnt(rl.metrics, 'rl_blocked_429') : 'N/A';

const report = `# Morodeutsch — Load Test Results
Generated: ${now}

## Summary

| Pipeline | VUs | p95 Latency | Threshold | Status | Error Rate |
|----------|-----|-------------|-----------|--------|------------|
| Text Correction | 20 | ${textP95}ms | <3000ms | ${status(textP95, THRESHOLD_TEXT_P95)} | ${typeof textErr === 'number' ? (textErr*100).toFixed(1)+'%' : textErr} |
| Audio / Whisper | 10 | ${audioP95}ms | <20000ms | ${status(audioP95, THRESHOLD_AUDIO_P95)} | ${typeof audioErr === 'number' ? (audioErr*100).toFixed(1)+'%' : audioErr} |
| OCR Burst | 0→30 | ${ocrP95}ms | <5000ms | ${status(ocrP95, THRESHOLD_OCR_P95)} | ${typeof ocrErr === 'number' ? (ocrErr*100).toFixed(1)+'%' : ocrErr} |

## Rate Limiter Verification

| Metric | Value | Expected |
|--------|-------|----------|
| Requests allowed | ${rlAllowed} | ~60 |
| Requests blocked (429) | ${rlBlocked} | ~10 |
| Behaviour | ${rlBlocked !== 'N/A' && parseInt(rlBlocked) >= 5 ? '✅ Rate limiter active' : '❌ Rate limiter may not be firing'} | |

## Detailed Metrics

### Text Correction (20 VUs × 60s)
${text ? `- Iterations: ${text.metrics?.iterations?.values?.count ?? 'N/A'}
- Avg latency: ${Math.round(text.metrics?.correction_latency_ms?.values?.avg ?? 0)}ms
- p95 latency: ${textP95}ms
- p99 latency: ${Math.round(text.metrics?.correction_latency_ms?.values?.['p(99)'] ?? 0)}ms
- Successes: ${cnt(text.metrics, 'correction_successes')}
- Rate limited: ${cnt(text.metrics, 'rate_limit_429s')}` : '_Test not run_'}

### Audio / Whisper (10 VUs × 120s)
${audio ? `- Iterations: ${audio.metrics?.iterations?.values?.count ?? 'N/A'}
- Avg latency: ${Math.round(audio.metrics?.audio_latency_ms?.values?.avg ?? 0)}ms
- p95 latency: ${audioP95}ms
- Whisper transcriptions: ${cnt(audio.metrics, 'whisper_transcriptions')}
- Rate limited: ${cnt(audio.metrics, 'audio_rate_limit_429s')}` : '_Test not run_'}

### OCR Burst (ramping 0→30→0 VUs)
${ocr ? `- Iterations: ${ocr.metrics?.iterations?.values?.count ?? 'N/A'}
- Avg latency: ${Math.round(ocr.metrics?.ocr_correction_latency_ms?.values?.avg ?? 0)}ms
- p95 latency: ${ocrP95}ms
- Successes: ${cnt(ocr.metrics, 'ocr_successes')}
- Rate limited: ${cnt(ocr.metrics, 'ocr_rate_limit_429s')}` : '_Test not run_'}

## How to Run

\`\`\`bash
# 1. Install k6
winget install k6          # Windows
brew install k6            # macOS

# 2. Get a test JWT (extract from browser DevTools after login)
#    Application → Local Storage → sb-<project>-auth-token → access_token

# 3. Run
export K6_AUTH_TOKEN="eyJ..."
export BASE_URL="http://localhost:3000"
bash tests/load/run-all.sh

# 4. Generate this report
node tests/load/generate-report.js
\`\`\`
`;

fs.writeFileSync(path.join(REPORTS, 'load-test-results.md'), report);
console.log('✅ Report written to reports/load-test-results.md');
console.log('');
console.log(`Text p95:  ${textP95}ms  (threshold 3000ms)  ${status(textP95, THRESHOLD_TEXT_P95)}`);
console.log(`Audio p95: ${audioP95}ms (threshold 20000ms) ${status(audioP95, THRESHOLD_AUDIO_P95)}`);
console.log(`OCR p95:   ${ocrP95}ms  (threshold 5000ms)  ${status(ocrP95, THRESHOLD_OCR_P95)}`);
console.log(`Rate limiter: ${rlBlocked} blocked of 70 requests`);
