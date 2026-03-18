// ─── Redis Sliding-Window Rate Limiter ───────────────────────────────────────
// Uses Upstash Redis (HTTP-based, serverless-safe — no persistent TCP connections).
//
// Algorithm: sliding window via sorted set.
//   Score  = request timestamp (ms)
//   Member = unique request ID (UUID)
//
//   On each request (atomic Lua script):
//     1. Remove members with score < (now - window_ms)   → trim expired
//     2. Count remaining members                          → current rate
//     3. If count >= limit: return [0, count, limit]      → blocked
//     4. ZADD new member with score=now                   → record request
//     5. EXPIRE key to window+1 seconds                   → auto-cleanup
//     6. Return [1, count+1, limit]                       → allowed
//
// Graceful degradation: if Redis is not configured or unreachable,
// falls back to per-process in-memory limiting with a warning log.

import { Redis } from '@upstash/redis';

// ─── Atomic Lua: sliding-window check-and-record ─────────────────────────────
// Returns array: [allowed (0|1), currentCount, limit]
const SLIDING_WINDOW_LUA = `
local key    = KEYS[1]
local now    = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit  = tonumber(ARGV[3])
local req_id = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window * 1000)

local count = tonumber(redis.call('ZCARD', key))

if count >= limit then
  return {0, count, limit}
end

redis.call('ZADD', key, now, req_id)
redis.call('EXPIRE', key, window + 1)

return {1, count + 1, limit}
`;

// ─── Fallback: in-process fixed-window ───────────────────────────────────────
// Only active when Redis is unavailable. Single-instance, not distributed.
const _fallback = new Map<string, { count: number; resetAt: number }>();

function fallbackCheck(key: string, limit: number, windowSec: number): boolean {
  const now = Date.now();
  const entry = _fallback.get(key);
  if (!entry || now > entry.resetAt) {
    _fallback.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// ─── Lazy Redis singleton ─────────────────────────────────────────────────────
// undefined = not yet attempted; null = env vars absent (will use fallback)
let _redis: Redis | null | undefined = undefined;

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn('[rate-limiter] UPSTASH env vars not set — using in-process fallback');
    _redis = null;
    return null;
  }
  _redis = new Redis({ url, token });
  return _redis;
}

// ─── Public export ────────────────────────────────────────────────────────────
// Drop-in async replacement for the old synchronous checkRateLimit.
// Returns true  → request is allowed
// Returns false → request is rate-limited

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<boolean> {
  const redis = getRedis();

  if (!redis) {
    return fallbackCheck(key, maxRequests, windowSeconds);
  }

  try {
    const result = (await redis.eval(
      SLIDING_WINDOW_LUA,
      [`rl:${key}`],
      [Date.now(), windowSeconds, maxRequests, crypto.randomUUID()],
    )) as [number, number, number];
    return result[0] === 1;
  } catch (err) {
    console.error('[rate-limiter] Redis unreachable, falling back to in-process:', err);
    return fallbackCheck(key, maxRequests, windowSeconds);
  }
}
