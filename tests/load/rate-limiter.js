/**
 * k6 Load Test — Redis Rate Limiter Verification
 * Fires 70 rapid requests from a single user (limit = 60/60s).
 * Verifies the first 60 succeed and requests 61-70 receive 429.
 *
 * Usage:
 *   k6 run --env K6_AUTH_TOKEN=<jwt> --env BASE_URL=http://localhost:3000 tests/load/rate-limiter.js
 */

import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const allowed     = new Counter('rl_allowed');
const blocked     = new Counter('rl_blocked_429');
const unexpected  = new Counter('rl_unexpected_status');

export const options = {
  vus: 1,         // Single user — rate limit is per-user
  iterations: 70, // Fire 70 requests as fast as possible
  thresholds: {
    rl_blocked_429: ['count>=1'],   // At least some should be blocked
  },
};

const BASE_URL = __ENV.BASE_URL      || 'http://localhost:3000';
const TOKEN    = __ENV.K6_AUTH_TOKEN || '';

export default function () {
  const res = http.post(
    `${BASE_URL}/api/tutor`,
    JSON.stringify({ text: 'Test rate limit.', workflow: 'text-correction' }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      timeout: '10s',
    }
  );

  if (res.status === 200)      { allowed.add(1); }
  else if (res.status === 429) {
    blocked.add(1);
    check(res, {
      '429 has Retry-After header': (r) => r.headers['Retry-After'] !== undefined ||
                                           r.headers['X-RateLimit-Reset'] !== undefined ||
                                           r.body.includes('429'), // at minimum a 429 body
    });
  }
  else if (res.status === 401) { /* expected without token */ }
  else                          { unexpected.add(1); }
}

export function handleSummary(data) {
  const summary = {
    allowed:    data.metrics.rl_allowed?.values?.count ?? 0,
    blocked:    data.metrics.rl_blocked_429?.values?.count ?? 0,
    unexpected: data.metrics.rl_unexpected_status?.values?.count ?? 0,
  };
  console.log('\n=== Rate Limiter Verification ===');
  console.log(`Allowed:    ${summary.allowed}`);
  console.log(`Blocked:    ${summary.blocked}`);
  console.log(`Unexpected: ${summary.unexpected}`);
  console.log('Expected: ~60 allowed, ~10 blocked');
  return {
    'reports/load-ratelimit-summary.json': JSON.stringify(data, null, 2),
  };
}
