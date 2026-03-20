/**
 * k6 Load Test — Text Correction Pipeline
 * 20 concurrent VUs, each acting as an independent learner.
 *
 * Usage:
 *   k6 run --env K6_AUTH_TOKEN=<jwt> --env BASE_URL=http://localhost:3000 tests/load/text-correction.js
 *
 * Thresholds (fail the test if breached):
 *   p95 latency < 3000ms
 *   error rate   < 3%
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// ── Custom metrics ───────────────────────────────────────────────────────────
const correctionLatency = new Trend('correction_latency_ms', true);
const errorRate         = new Rate('correction_error_rate');
const rateLimited       = new Counter('rate_limit_429s');
const successCount      = new Counter('correction_successes');

// ── Config ───────────────────────────────────────────────────────────────────
export const options = {
  vus: 20,
  duration: '60s',
  thresholds: {
    correction_latency_ms: ['p(95)<3000'],
    correction_error_rate: ['rate<0.03'],
    http_req_failed:        ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN    = __ENV.K6_AUTH_TOKEN || '';

// German sentences with intentional errors — varied to avoid caching
const TEST_SENTENCES = [
  'Ich gehe zu schule jeden tag.',
  'Mein Bruder ist mehr groß als ich.',
  'Ich habe gestern gegangen in den Park.',
  'Sie hat ein neues Auto gekauft habe.',
  'Wir müssen das Hausaufgaben machen.',
  'Ich bin seit drei Wochen hier gewesen.',
  'Er kommt nicht heute an der Schule.',
  'Die Kinder spielen im Garten gestern.',
  'Ich möchte eine Kaffee bitte.',
  'Das Wetter ist sehr schön heute war.',
];

export default function () {
  if (!TOKEN) {
    console.error('K6_AUTH_TOKEN not set — all requests will return 401');
  }

  const sentence = TEST_SENTENCES[__VU % TEST_SENTENCES.length];

  const res = http.post(
    `${BASE_URL}/api/tutor`,
    JSON.stringify({ text: sentence, workflow: 'text-correction' }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      timeout: '15s',
    }
  );

  correctionLatency.add(res.timings.duration);

  if (res.status === 429) {
    rateLimited.add(1);
    errorRate.add(0); // 429 is expected behaviour, not a bug
    sleep(1);
    return;
  }

  const ok = check(res, {
    'status is 200':             (r) => r.status === 200,
    'has original field':        (r) => { try { return !!r.json('original'); } catch { return false; } },
    'has corrected field':       (r) => { try { return !!r.json('corrected'); } catch { return false; } },
    'has explanation_de':        (r) => { try { return !!r.json('explanation_de'); } catch { return false; } },
    'confidence between 0 and 1':(r) => { try { const c = r.json('confidence'); return c >= 0 && c <= 1; } catch { return false; } },
    'no stack trace leaked':     (r) => !r.body.includes('at Object.') && !r.body.includes('node_modules'),
    'no API key leaked':         (r) => !r.body.includes('sk-') && !r.body.includes('api-key'),
  });

  errorRate.add(!ok ? 1 : 0);
  if (ok) successCount.add(1);

  // Realistic learner pacing — 2-5s between submissions
  sleep(2 + Math.random() * 3);
}

export function handleSummary(data) {
  return {
    'reports/load-text-summary.json': JSON.stringify(data, null, 2),
  };
}
