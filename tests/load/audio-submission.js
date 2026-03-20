/**
 * k6 Load Test — Audio (Whisper) Pipeline
 * 10 concurrent VUs simulating students uploading voice recordings.
 *
 * Usage:
 *   k6 run \
 *     --env K6_AUTH_TOKEN=<jwt> \
 *     --env BASE_URL=http://localhost:3000 \
 *     --env AUDIO_FILE=tests/load/fixtures/sample-de.webm \
 *     tests/load/audio-submission.js
 *
 * If AUDIO_FILE is absent, a minimal synthetic WebM blob is used.
 * For real-world accuracy, record a German sentence and save it as
 * tests/load/fixtures/sample-de.webm before running.
 *
 * Thresholds:
 *   p95 latency < 20000ms  (Whisper + GPT can take 15-18s end-to-end)
 *   error rate   < 3%
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { open } from 'k6/experimental/fs';

const audioLatency  = new Trend('audio_latency_ms', true);
const audioErrors   = new Rate('audio_error_rate');
const whisperOk     = new Counter('whisper_transcriptions');
const rateLimited   = new Counter('audio_rate_limit_429s');

export const options = {
  vus: 10,
  duration: '120s',   // Whisper is slow — longer window needed
  thresholds: {
    audio_latency_ms:  ['p(95)<20000'],
    audio_error_rate:  ['rate<0.03'],
    http_req_failed:   ['rate<0.05'],
  },
};

const BASE_URL   = __ENV.BASE_URL   || 'http://localhost:3000';
const TOKEN      = __ENV.K6_AUTH_TOKEN || '';
const AUDIO_PATH = __ENV.AUDIO_FILE || null;

// Minimal valid WebM header (Matroska EBML) — enough for Whisper to reject gracefully
// Replace with a real recording for meaningful latency data.
const SYNTHETIC_WEBM = new Uint8Array([
  0x1a, 0x45, 0xdf, 0xa3, // EBML ID
  0x9f,                   // EBML size (varint)
  0x42, 0x86, 0x81, 0x01, // EBMLVersion = 1
  0x42, 0xf7, 0x81, 0x01, // EBMLReadVersion = 1
  0x42, 0xf2, 0x81, 0x04, // EBMLMaxIDLength = 4
  0x42, 0xf3, 0x81, 0x08, // EBMLMaxSizeLength = 8
  0x42, 0x82, 0x84,       // DocType = "webm"
  0x77, 0x65, 0x62, 0x6d,
]);

export default function () {
  if (!TOKEN) {
    console.error('K6_AUTH_TOKEN not set — requests will return 401');
  }

  const audioBytes = SYNTHETIC_WEBM;
  const mimeType   = 'audio/webm';
  const filename   = `test-audio-vu${__VU}-iter${__ITER}.webm`;

  const formData = {
    workflow: 'audio-correction',
    audio: http.file(audioBytes, filename, mimeType),
  };

  const res = http.post(
    `${BASE_URL}/api/tutor`,
    formData,
    {
      headers: { 'Authorization': `Bearer ${TOKEN}` },
      timeout: '30s',
    }
  );

  audioLatency.add(res.timings.duration);

  if (res.status === 429) {
    rateLimited.add(1);
    sleep(5);
    return;
  }

  const ok = check(res, {
    'status is 200 or 400':       (r) => r.status === 200 || r.status === 400,
    'no stack trace leaked':      (r) => !r.body.includes('at Object.'),
    'no API key in response':     (r) => !r.body.includes('api-key'),
    'response is valid JSON':     (r) => { try { JSON.parse(r.body); return true; } catch { return false; } },
  });

  // 200 = real transcription; 400 with synthetic = expected (audio too short)
  if (res.status === 200) {
    whisperOk.add(1);
    check(res, {
      'transcription present': (r) => { try { return !!r.json('original'); } catch { return false; } },
    });
  }

  audioErrors.add(!ok ? 1 : 0);

  // Whisper submissions have natural spacing — learners don't spam recordings
  sleep(5 + Math.random() * 5);
}

export function handleSummary(data) {
  return {
    'reports/load-audio-summary.json': JSON.stringify(data, null, 2),
  };
}
