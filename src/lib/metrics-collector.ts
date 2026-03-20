import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MetricsBucket {
  timestamp: number; // start-of-hour epoch ms
  text_requests: number;
  audio_requests: number;
  ocr_requests: number;
  text_latency_sum: number;
  audio_latency_sum: number;
  ocr_latency_sum: number;
  text_errors: number;
  audio_errors: number;
  ocr_errors: number;
  errors: number;
}

export interface MetricsSummary {
  tutor_requests_today: number;
  avg_text_latency_ms: number;
  avg_audio_latency_ms: number;
  avg_ocr_latency_ms: number;
  error_rate: number;
  breakdown: {
    text: { count: number; avg_latency_ms: number; errors: number };
    audio: { count: number; avg_latency_ms: number; errors: number };
    ocr: { count: number; avg_latency_ms: number; errors: number };
  };
  uptime_seconds: number;
  collected_since: string;
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

const BUCKET_DURATION_MS = 60 * 60 * 1000; // 1 hour
const MAX_BUCKET_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

const buckets: Map<number, MetricsBucket> = new Map();
const startTime = Date.now();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bucketKey(now: number): number {
  return Math.floor(now / BUCKET_DURATION_MS) * BUCKET_DURATION_MS;
}

function getOrCreateBucket(now: number): MetricsBucket {
  const key = bucketKey(now);
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = {
      timestamp: key,
      text_requests: 0,
      audio_requests: 0,
      ocr_requests: 0,
      text_latency_sum: 0,
      audio_latency_sum: 0,
      ocr_latency_sum: 0,
      text_errors: 0,
      audio_errors: 0,
      ocr_errors: 0,
      errors: 0,
    };
    buckets.set(key, bucket);
  }
  return bucket;
}

function pruneOldBuckets(): void {
  const cutoff = Date.now() - MAX_BUCKET_AGE_MS;
  for (const [key] of buckets) {
    if (key < cutoff) {
      buckets.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record a single tutor request metric.
 * Call this from any API route after processing a request.
 */
export function recordMetric(
  type: 'text' | 'audio' | 'ocr',
  latencyMs: number,
  isError: boolean,
): void {
  const now = Date.now();
  const bucket = getOrCreateBucket(now);

  switch (type) {
    case 'text':
      bucket.text_requests += 1;
      bucket.text_latency_sum += latencyMs;
      if (isError) bucket.text_errors += 1;
      break;
    case 'audio':
      bucket.audio_requests += 1;
      bucket.audio_latency_sum += latencyMs;
      if (isError) bucket.audio_errors += 1;
      break;
    case 'ocr':
      bucket.ocr_requests += 1;
      bucket.ocr_latency_sum += latencyMs;
      if (isError) bucket.ocr_errors += 1;
      break;
  }

  if (isError) bucket.errors += 1;

  // Prune stale buckets periodically (cheap in single-threaded Node.js)
  pruneOldBuckets();

  logger.info('metrics:record', { type, latencyMs, isError });
}

/**
 * Aggregate all stored buckets into a summary object.
 */
export function getMetrics(): MetricsSummary {
  pruneOldBuckets();

  let textCount = 0;
  let audioCount = 0;
  let ocrCount = 0;
  let textLatencySum = 0;
  let audioLatencySum = 0;
  let ocrLatencySum = 0;
  let textErrors = 0;
  let audioErrors = 0;
  let ocrErrors = 0;
  let totalErrors = 0;
  let earliest = Infinity;

  for (const bucket of buckets.values()) {
    textCount += bucket.text_requests;
    audioCount += bucket.audio_requests;
    ocrCount += bucket.ocr_requests;
    textLatencySum += bucket.text_latency_sum;
    audioLatencySum += bucket.audio_latency_sum;
    ocrLatencySum += bucket.ocr_latency_sum;
    textErrors += bucket.text_errors;
    audioErrors += bucket.audio_errors;
    ocrErrors += bucket.ocr_errors;
    totalErrors += bucket.errors;
    if (bucket.timestamp < earliest) earliest = bucket.timestamp;
  }

  const totalRequests = textCount + audioCount + ocrCount;

  const avgText = textCount > 0 ? Math.round(textLatencySum / textCount) : 0;
  const avgAudio = audioCount > 0 ? Math.round(audioLatencySum / audioCount) : 0;
  const avgOcr = ocrCount > 0 ? Math.round(ocrLatencySum / ocrCount) : 0;
  const errorRate =
    totalRequests > 0
      ? Math.round((totalErrors / totalRequests) * 100) / 100
      : 0;

  const collectedSince =
    earliest === Infinity ? new Date().toISOString() : new Date(earliest).toISOString();

  return {
    tutor_requests_today: totalRequests,
    avg_text_latency_ms: avgText,
    avg_audio_latency_ms: avgAudio,
    avg_ocr_latency_ms: avgOcr,
    error_rate: errorRate,
    breakdown: {
      text: { count: textCount, avg_latency_ms: avgText, errors: textErrors },
      audio: { count: audioCount, avg_latency_ms: avgAudio, errors: audioErrors },
      ocr: { count: ocrCount, avg_latency_ms: avgOcr, errors: ocrErrors },
    },
    uptime_seconds: Math.round((Date.now() - startTime) / 1000),
    collected_since: collectedSince,
  };
}

/**
 * Clear all stored metrics. Useful for testing.
 */
export function resetMetrics(): void {
  buckets.clear();
  logger.info('metrics:reset', { message: 'All metrics buckets cleared' });
}
