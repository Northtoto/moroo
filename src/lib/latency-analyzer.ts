// ─── Latency Analyzer ─────────────────────────────────────────────────
// In-memory ring buffer for per-request latency records with statistical
// analysis, percentile computation, and bottleneck detection.
// Works alongside metrics-collector.ts which tracks hourly aggregate buckets.
// ──────────────────────────────────────────────────────────────────────

import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LatencyRecord {
  timestamp: number;
  workflow: 'text' | 'audio' | 'ocr';
  total_ms: number;
  whisper_ms?: number; // audio only
  gpt_ms: number;
  input_length: number;
  confidence: number;
}

export interface LatencyStats {
  count: number;
  avg_ms: number;
  min_ms: number;
  max_ms: number;
  p50_ms: number;
  p95_ms: number;
}

export interface LatencyReport {
  period: string;
  sample_count: number;
  text: LatencyStats;
  audio: LatencyStats;
  ocr: LatencyStats;
  percentiles: { p50: number; p90: number; p95: number; p99: number };
  bottleneck_analysis: string[];
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// SLA thresholds (milliseconds)
// ---------------------------------------------------------------------------

const SLA = {
  text: { p95: 2000, warn: 1500 },
  audio: { p95: 6000, warn: 4500 },
  ocr: { p95: 2500, warn: 1800 },
  whisper: { p95: 4000, warn: 3000 },
  gpt: { p95: 2000, warn: 1200 },
} as const;

// ---------------------------------------------------------------------------
// Ring buffer
// ---------------------------------------------------------------------------

const MAX_RECORDS = 1000;
const buffer: LatencyRecord[] = [];
let writeIndex = 0;
let totalRecorded = 0;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Store a latency record in the ring buffer. Once the buffer is full the
 * oldest entry is silently overwritten.
 */
export function recordLatency(record: LatencyRecord): void {
  if (buffer.length < MAX_RECORDS) {
    buffer.push(record);
  } else {
    buffer[writeIndex] = record;
  }
  writeIndex = (writeIndex + 1) % MAX_RECORDS;
  totalRecorded += 1;

  logger.info('latency:record', {
    workflow: record.workflow,
    total_ms: record.total_ms,
    gpt_ms: record.gpt_ms,
    whisper_ms: record.whisper_ms,
  });
}

/**
 * Compute a full latency report from the current buffer contents.
 */
export function getLatencyReport(): LatencyReport {
  const now = Date.now();
  const records = getRecords();

  const textRecords = records.filter((r) => r.workflow === 'text');
  const audioRecords = records.filter((r) => r.workflow === 'audio');
  const ocrRecords = records.filter((r) => r.workflow === 'ocr');

  const allTotals = records.map((r) => r.total_ms);

  const oldestTs = records.length > 0 ? Math.min(...records.map((r) => r.timestamp)) : now;
  const periodMinutes = Math.round((now - oldestTs) / 60_000);

  return {
    period: records.length > 0
      ? `Last ${periodMinutes} minutes (${records.length} samples)`
      : 'No data collected yet',
    sample_count: records.length,
    text: computeStats(textRecords.map((r) => r.total_ms)),
    audio: computeStats(audioRecords.map((r) => r.total_ms)),
    ocr: computeStats(ocrRecords.map((r) => r.total_ms)),
    percentiles: {
      p50: percentile(allTotals, 50),
      p90: percentile(allTotals, 90),
      p95: percentile(allTotals, 95),
      p99: percentile(allTotals, 99),
    },
    bottleneck_analysis: analyzeBottlenecks(),
    recommendations: generateRecommendations(),
  };
}

/**
 * Identify the primary bottleneck for each workflow based on collected data.
 */
export function analyzeBottlenecks(): string[] {
  const records = getRecords();
  if (records.length === 0) {
    return ['Insufficient data — no latency records have been collected yet.'];
  }

  const findings: string[] = [];

  // ── Audio pipeline breakdown ───────────────────────────────────────────
  const audioRecords = records.filter((r) => r.workflow === 'audio');
  if (audioRecords.length > 0) {
    const avgWhisper = mean(audioRecords.map((r) => r.whisper_ms ?? 0));
    const avgGpt = mean(audioRecords.map((r) => r.gpt_ms));
    const avgTotal = mean(audioRecords.map((r) => r.total_ms));
    const whisperPct = avgTotal > 0 ? Math.round((avgWhisper / avgTotal) * 100) : 0;
    const overhead = avgTotal - avgWhisper - avgGpt;

    findings.push(
      `Audio pipeline: Whisper accounts for ~${whisperPct}% of total latency ` +
        `(avg ${Math.round(avgWhisper)}ms / ${Math.round(avgTotal)}ms total).`,
    );

    if (avgWhisper > SLA.whisper.warn) {
      findings.push(
        `BOTTLENECK: Whisper transcription averaging ${Math.round(avgWhisper)}ms ` +
          `exceeds warning threshold of ${SLA.whisper.warn}ms.`,
      );
    }

    if (overhead > 500) {
      findings.push(
        `Audio overhead (FormData parsing + network) averaging ${Math.round(overhead)}ms — ` +
          `consider audio compression or connection reuse.`,
      );
    }
  }

  // ── GPT latency across all workflows ───────────────────────────────────
  const gptLatencies = records.map((r) => r.gpt_ms);
  const avgGptAll = mean(gptLatencies);
  const p95Gpt = percentile(gptLatencies, 95);

  if (p95Gpt > SLA.gpt.p95) {
    findings.push(
      `BOTTLENECK: GPT-4o p95 latency is ${Math.round(p95Gpt)}ms ` +
        `(SLA target: ${SLA.gpt.p95}ms). Consider streaming or prompt trimming.`,
    );
  } else {
    findings.push(
      `GPT-4o latency is healthy — avg ${Math.round(avgGptAll)}ms, p95 ${Math.round(p95Gpt)}ms.`,
    );
  }

  // ── Text / OCR checks ─────────────────────────────────────────────────
  for (const wf of ['text', 'ocr'] as const) {
    const wfRecords = records.filter((r) => r.workflow === wf);
    if (wfRecords.length === 0) continue;
    const p95Total = percentile(wfRecords.map((r) => r.total_ms), 95);
    const target = SLA[wf].p95;
    if (p95Total > target) {
      findings.push(
        `${wf.toUpperCase()} pipeline p95 is ${Math.round(p95Total)}ms — ` +
          `exceeds SLA target of ${target}ms.`,
      );
    }
  }

  // ── Correlation: input length vs latency ───────────────────────────────
  if (records.length >= 10) {
    const corr = pearsonCorrelation(
      records.map((r) => r.input_length),
      records.map((r) => r.gpt_ms),
    );
    if (corr > 0.6) {
      findings.push(
        `Strong positive correlation (r=${corr.toFixed(2)}) between input length and GPT latency — ` +
          `longer inputs significantly increase response time.`,
      );
    }
  }

  // ── Low-confidence requests tend to be slower ──────────────────────────
  const lowConf = records.filter((r) => r.confidence < 0.7);
  const highConf = records.filter((r) => r.confidence >= 0.7);
  if (lowConf.length >= 5 && highConf.length >= 5) {
    const avgLow = mean(lowConf.map((r) => r.total_ms));
    const avgHigh = mean(highConf.map((r) => r.total_ms));
    if (avgLow > avgHigh * 1.3) {
      findings.push(
        `Low-confidence corrections average ${Math.round(avgLow)}ms vs ` +
          `${Math.round(avgHigh)}ms for high-confidence — uncertain inputs take ~${Math.round(((avgLow - avgHigh) / avgHigh) * 100)}% longer.`,
      );
    }
  }

  return findings;
}

/**
 * Return a snapshot of all records currently in the buffer, ordered oldest-first.
 */
export function getRecords(): LatencyRecord[] {
  if (buffer.length < MAX_RECORDS) {
    return [...buffer];
  }
  // Ring buffer is full — reconstruct chronological order
  return [...buffer.slice(writeIndex), ...buffer.slice(0, writeIndex)];
}

/**
 * Clear the ring buffer. Useful for testing.
 */
export function resetLatencyBuffer(): void {
  buffer.length = 0;
  writeIndex = 0;
  totalRecorded = 0;
  logger.info('latency:reset', { message: 'Latency ring buffer cleared' });
}

/**
 * Return the total number of records ever recorded (including overwritten).
 */
export function getTotalRecorded(): number {
  return totalRecorded;
}

// ---------------------------------------------------------------------------
// Statistical helpers
// ---------------------------------------------------------------------------

/**
 * Compute the k-th percentile of a numeric array using linear interpolation.
 * Returns 0 for empty arrays.
 */
export function percentile(values: number[], k: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];

  // Use the "exclusive" percentile method (similar to Excel PERCENTILE.EXC)
  const index = (k / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const fraction = index - lower;

  if (upper >= sorted.length) return sorted[sorted.length - 1];
  return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function computeStats(values: number[]): LatencyStats {
  if (values.length === 0) {
    return { count: 0, avg_ms: 0, min_ms: 0, max_ms: 0, p50_ms: 0, p95_ms: 0 };
  }
  return {
    count: values.length,
    avg_ms: Math.round(mean(values)),
    min_ms: Math.round(Math.min(...values)),
    max_ms: Math.round(Math.max(...values)),
    p50_ms: Math.round(percentile(values, 50)),
    p95_ms: Math.round(percentile(values, 95)),
  };
}

/**
 * Pearson correlation coefficient between two equal-length numeric arrays.
 */
function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;

  const xMean = mean(xs);
  const yMean = mean(ys);

  let num = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - xMean;
    const dy = ys[i] - yMean;
    num += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  return denom === 0 ? 0 : num / denom;
}

// ---------------------------------------------------------------------------
// Recommendation engine
// ---------------------------------------------------------------------------

function generateRecommendations(): string[] {
  const records = getRecords();
  if (records.length === 0) {
    return ['Collect latency data before generating recommendations.'];
  }

  const tips: string[] = [];

  // ── Audio-specific ─────────────────────────────────────────────────────
  const audioRecords = records.filter((r) => r.workflow === 'audio');
  if (audioRecords.length > 0) {
    const avgWhisper = mean(audioRecords.map((r) => r.whisper_ms ?? 0));

    if (avgWhisper > SLA.whisper.warn) {
      tips.push(
        'Consider deploying Whisper Turbo (whisper-large-v3-turbo) for faster transcription — ' +
          'typically 30-50% faster with minimal accuracy loss.',
      );
      tips.push(
        'Compress audio client-side before upload (target 64kbps Opus/WebM) to reduce ' +
          'transfer time and Whisper processing.',
      );
    }

    const largePct = audioRecords.filter((r) => r.input_length > 200).length / audioRecords.length;
    if (largePct > 0.3) {
      tips.push(
        'Over 30% of audio inputs produce long transcriptions — consider chunking audio ' +
          'into shorter segments for parallel processing.',
      );
    }
  }

  // ── GPT-specific ───────────────────────────────────────────────────────
  const p95Gpt = percentile(records.map((r) => r.gpt_ms), 95);
  if (p95Gpt > SLA.gpt.warn) {
    tips.push(
      'Stream GPT responses to reduce Time-To-First-Byte (TTFB) — users see partial ' +
        'results while the model finishes generating.',
    );
    tips.push(
      'Cache corrections for repeated/similar inputs using a semantic similarity check ' +
          '(e.g., embedding distance < 0.05).',
    );
  }

  // ── General ────────────────────────────────────────────────────────────
  tips.push(
    'Enable HTTP keep-alive / connection pooling for Azure OpenAI calls to eliminate ' +
      'TCP + TLS handshake overhead (~50-150ms per cold connection).',
  );

  const errorRecords = records.filter((r) => r.confidence < 0.5);
  if (errorRecords.length / records.length > 0.1) {
    tips.push(
      'High rate of low-confidence responses (>10%) — review prompt engineering to ' +
        'improve first-pass accuracy and reduce retries.',
    );
  }

  return tips;
}
