/**
 * k6 Load Test — OCR Burst
 * Simulates students uploading homework photos in rapid succession.
 * OCR is client-side (Tesseract.js) so this test targets the downstream
 * /api/tutor text-correction step with extracted OCR text.
 *
 * Usage:
 *   k6 run --env K6_AUTH_TOKEN=<jwt> --env BASE_URL=http://localhost:3000 tests/load/ocr-burst.js
 *
 * Thresholds:
 *   p95 latency < 5000ms
 *   error rate   < 3%
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const ocrLatency   = new Trend('ocr_correction_latency_ms', true);
const ocrErrors    = new Rate('ocr_error_rate');
const rateLimited  = new Counter('ocr_rate_limit_429s');
const ocrSuccesses = new Counter('ocr_successes');

export const options = {
  // Burst profile: ramp to 30 VUs quickly, sustain, then ramp down
  scenarios: {
    ocr_burst: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 30 },  // ramp up to 30 concurrent
        { duration: '30s', target: 30 },  // sustain burst
        { duration: '10s', target: 0  },  // ramp down
      ],
    },
  },
  thresholds: {
    ocr_correction_latency_ms: ['p(95)<5000'],
    ocr_error_rate:            ['rate<0.03'],
    http_req_failed:           ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL       || 'http://localhost:3000';
const TOKEN    = __ENV.K6_AUTH_TOKEN  || '';

// Simulated OCR outputs — text extracted from German homework photos
const OCR_SAMPLES = [
  'Ich bin in die Schule gegangen und habe meine Hausaufgabe vergessen.',
  'Das Wetter ist heute sehr schön, aber gestern war es regnerisch gewesen.',
  'Meine Mutter hat für uns ein leckeres Abendessen gekocht haben.',
  'Ich möchten gerne ein Stück Kuchen essen, bitte.',
  'Die Kinder haben im Park gespielt und haben viel Spaß gehabt.',
  'Er hat seinen Freund angeruft und mit ihm über das Wochenende gesprochen.',
  'Wir sind letzten Sommer nach Berlin gefahren und haben viele Sehenswürdigkeiten besucht.',
  'Sie liest jeden Abend ein Buch bevor sie schlafen geht.',
];

export default function () {
  const text = OCR_SAMPLES[(__VU + __ITER) % OCR_SAMPLES.length];

  const res = http.post(
    `${BASE_URL}/api/tutor`,
    JSON.stringify({ text, workflow: 'ocr-correction' }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      timeout: '15s',
    }
  );

  ocrLatency.add(res.timings.duration);

  if (res.status === 429) {
    rateLimited.add(1);
    sleep(2);
    return;
  }

  const ok = check(res, {
    'status is 200':         (r) => r.status === 200,
    'corrected field exists':(r) => { try { return !!r.json('corrected'); } catch { return false; } },
    'inputType is image':    (r) => { try { return r.json('inputType') === 'image'; } catch { return false; } },
    'no secrets in body':    (r) => !r.body.includes('api-key') && !r.body.includes('AZURE'),
  });

  ocrErrors.add(!ok ? 1 : 0);
  if (ok) ocrSuccesses.add(1);

  sleep(1 + Math.random() * 2);
}

export function handleSummary(data) {
  return {
    'reports/load-ocr-summary.json': JSON.stringify(data, null, 2),
  };
}
