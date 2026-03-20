# Morodeutsch Tutor — Latency Analysis Report

**Date:** 2026-03-20
**Author:** Performance Engineering
**Scope:** `/api/tutor` route — text, audio, and OCR correction pipelines

---

## 1. Architecture Overview

The tutor API route (`src/app/api/tutor/route.ts`) handles three correction workflows, each calling Azure OpenAI services:

```
Text Pipeline:   Client → JSON parse → GPT-4o → Response
OCR Pipeline:    Client → JSON parse → GPT-4o → Response
Audio Pipeline:  Client → FormData parse → Whisper → GPT-4o → Response
```

Performance is logged at each stage via `[tutor:perf]` console prefixes. The `metrics-collector.ts` module aggregates hourly buckets for dashboard display, while `latency-analyzer.ts` maintains a 1000-record ring buffer for fine-grained percentile analysis and bottleneck detection.

---

## 2. Expected Latency Budget

| Pipeline | Component | Target | Expected Range | Timeout |
|----------|-----------|--------|----------------|---------|
| Text | JSON body parse | < 10ms | 1–5ms | — |
| Text | GPT-4o correction call | < 2,000ms | 800–1,500ms | 20s |
| Text | Response serialization | < 10ms | 1–5ms | — |
| **Text** | **Total** | **< 2,000ms** | **1,000–2,000ms** | — |
| Audio | FormData parse + blob copy | < 100ms | 20–80ms | — |
| Audio | Whisper transcription | < 4,000ms | 2,000–4,000ms | 25s |
| Audio | GPT-4o correction call | < 2,000ms | 800–1,500ms | 20s |
| Audio | Response serialization | < 10ms | 1–5ms | — |
| **Audio** | **Total** | **< 6,000ms** | **3,000–6,000ms** | — |
| OCR | JSON body parse | < 10ms | 1–5ms | — |
| OCR | GPT-4o correction call | < 2,000ms | 800–1,500ms | 20s |
| OCR | Response serialization | < 10ms | 1–5ms | — |
| **OCR** | **Total** | **< 2,500ms** | **1,000–2,000ms** | — |

### Notes on Timeout Configuration

- **Whisper:** 25-second `AbortSignal.timeout` — intentionally generous because long audio clips (>30s) can take 5–10 seconds to process.
- **GPT-4o:** 20-second `AbortSignal.timeout` — GPT-4o rarely exceeds 3 seconds, but the margin accounts for Azure cold starts and rate-limit queuing.

---

## 3. Bottleneck Analysis

### 3.1 Primary Bottleneck: Whisper Transcription (Audio Pipeline)

Whisper is the dominant cost in the audio pipeline, consuming 55–70% of total request time.

**Why Whisper is slow:**
- Audio file must be fully uploaded before processing begins (no streaming input).
- Azure Whisper deployment processes sequentially — no built-in parallelism per request.
- Larger audio files (>10s) scale roughly linearly with duration.
- The `audio/webm` codec from browser `MediaRecorder` is not Whisper's preferred format, adding internal transcoding time.

**Evidence from route.ts logging:**
```
[tutor:perf] Whisper transcription complete { duration_ms: 2500, transcribed_length: 45 }
[tutor:perf] Audio correction pipeline complete { total_ms: 4200, whisper_ms: 2500, gpt_ms: 1700 }
```
Whisper took 2,500ms out of 4,200ms total (59.5%).

### 3.2 Secondary Bottleneck: GPT-4o Response Time

GPT-4o is the sole external call for text and OCR pipelines and the second stage for audio.

**Factors affecting GPT-4o latency:**
- **Prompt length:** The system prompt includes student context (native language, CEFR level, common errors), adding ~200 tokens of input per request.
- **max_completion_tokens: 1200** — Generous limit; typical corrections use 150–400 tokens but the model may "think" longer for complex grammar.
- **Cold starts:** Azure OpenAI deployments can have 1–2 second cold starts if idle.
- **Rate limiting:** At 60 requests/minute (configured in `withApiGuard`), bursts can hit Azure's token-per-minute limit, adding queue delay.

### 3.3 Network and Parsing Overhead

| Component | Estimated Cost | Notes |
|-----------|---------------|-------|
| FormData parsing | 20–80ms | Depends on audio file size; `arrayBuffer()` copies data |
| JSON body parsing | 1–5ms | Negligible for text/OCR payloads |
| Azure TLS handshake | 50–150ms | Per cold connection (mitigated with keep-alive) |
| Response JSON serialization | 1–5ms | Negligible |

### 3.4 Student Model Updates (Non-blocking)

After the correction response is computed, the route fires two background updates:
```ts
updateStudentModel(user.id, result, ...).catch(console.error);
updateAccuracy(user.id, wasCorrect).catch(console.error);
```
These use `.catch()` and do not block the response, so they add 0ms to user-perceived latency. However, if Supabase is slow they could create backpressure in the Node.js event loop on high-traffic deployments.

---

## 4. Optimization Recommendations

### 4.1 High Impact

| # | Recommendation | Expected Savings | Effort |
|---|---------------|-----------------|--------|
| 1 | **Stream GPT responses** — Use `stream: true` in the Azure OpenAI call and forward SSE chunks to the client. Reduces Time-To-First-Byte from 800–1500ms to ~200ms. | -600ms TTFB | Medium |
| 2 | **Deploy Whisper Turbo** — `whisper-large-v3-turbo` is 30–50% faster with <1% accuracy loss. | -800ms avg on audio | Low |
| 3 | **Client-side audio compression** — Encode as 64kbps Opus before upload (currently raw WebM). Smaller files = faster upload + faster Whisper processing. | -300ms avg | Medium |

### 4.2 Medium Impact

| # | Recommendation | Expected Savings | Effort |
|---|---------------|-----------------|--------|
| 4 | **Connection pooling / keep-alive** — Reuse TCP connections to Azure endpoints via a custom `fetch` agent. Eliminates TLS handshake on repeat calls. | -100ms per call | Low |
| 5 | **Semantic caching** — Cache corrections for inputs with embedding cosine similarity > 0.95. Common student errors repeat frequently. | -800ms on cache hit | High |
| 6 | **Reduce max_completion_tokens** — Lower from 1200 to 600 for text/OCR (typical response is 150–400 tokens). GPT may generate faster when the limit is tighter. | -50ms avg | Low |

### 4.3 Low Impact / Future

| # | Recommendation | Expected Savings | Effort |
|---|---------------|-----------------|--------|
| 7 | **Parallel student model lookup** — Fetch `buildN8nContext()` in parallel with FormData parsing (audio) or body parsing (text). Currently sequential. | -20ms avg | Low |
| 8 | **Edge deployment** — Deploy the API route to an Azure region closer to users (if not already colocated with the OpenAI resource). | -30ms RTT | Medium |
| 9 | **Prompt optimization** — Reduce system prompt token count by 30% via abbreviation and structured formatting. | -30ms avg | Low |

---

## 5. Monitoring Integration

### 5.1 How metrics-collector.ts and latency-analyzer.ts Work Together

```
                    ┌─────────────────────┐
   /api/tutor       │   route.ts          │
   request ────────►│                     │
                    │  performance.now()   │
                    │  ... process ...     │
                    │  performance.now()   │
                    │         │            │
                    └─────────┼────────────┘
                              │
                   ┌──────────┴──────────┐
                   ▼                      ▼
        ┌──────────────────┐   ┌──────────────────────┐
        │ metrics-collector│   │  latency-analyzer     │
        │                  │   │                       │
        │ recordMetric()   │   │ recordLatency()       │
        │ • hourly buckets │   │ • ring buffer (1000)  │
        │ • sum/count agg  │   │ • per-record detail   │
        │ • 24h retention  │   │ • percentiles         │
        │                  │   │ • bottleneck analysis  │
        ├──────────────────┤   ├───────────────────────┤
        │ getMetrics()     │   │ getLatencyReport()    │
        │ → dashboard view │   │ → deep analysis       │
        │ → error rates    │   │ → recommendations     │
        │ → avg latencies  │   │ → correlation checks  │
        └──────────────────┘   └───────────────────────┘
```

**metrics-collector.ts** provides the operational dashboard view:
- Aggregates into hourly buckets (cheap, fixed memory).
- Tracks request counts, latency sums, and error counts per workflow.
- Powers the `/api/health` endpoint's metrics summary.
- 24-hour retention with automatic pruning.

**latency-analyzer.ts** provides the deep performance analysis:
- Stores individual request records in a 1000-entry ring buffer.
- Computes exact percentiles (p50, p90, p95, p99) across all workflows.
- Runs bottleneck detection: identifies which component (Whisper, GPT, network) dominates.
- Correlation analysis: detects if input length or confidence level affects latency.
- Generates actionable optimization recommendations based on observed patterns.

### 5.2 Integration Point

Both modules should be called from `route.ts` after each successful response:

```ts
import { recordMetric } from '@/lib/metrics-collector';
import { recordLatency } from '@/lib/latency-analyzer';

// After computing result:
recordMetric('audio', totalDuration, false);
recordLatency({
  timestamp: Date.now(),
  workflow: 'audio',
  total_ms: totalDuration,
  whisper_ms: whisperDuration,
  gpt_ms: gptDuration,
  input_length: transcribed.length,
  confidence: result.confidence,
});
```

---

## 6. SLA Targets

### 6.1 Latency SLAs

| Metric | Target | Degraded | Critical |
|--------|--------|----------|----------|
| Text correction p50 | < 1,200ms | 1,200–2,000ms | > 2,000ms |
| Text correction p95 | < 2,000ms | 2,000–3,000ms | > 3,000ms |
| Audio correction p50 | < 3,500ms | 3,500–5,000ms | > 5,000ms |
| Audio correction p95 | < 6,000ms | 6,000–8,000ms | > 8,000ms |
| OCR correction p50 | < 1,500ms | 1,500–2,000ms | > 2,000ms |
| OCR correction p95 | < 2,500ms | 2,500–3,500ms | > 3,500ms |

### 6.2 Reliability SLAs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Error rate (all workflows) | < 5% | Rolling 1-hour window via metrics-collector |
| Whisper transcription success | > 95% | Excludes empty/silent audio submissions |
| GPT parse success | > 99% | JSON parsing of correction response |
| Timeout rate | < 2% | Requests hitting AbortSignal.timeout |

### 6.3 Alerting Thresholds

Recommended alerting rules for production monitoring:

```
WARN  — p95 latency exceeds "Degraded" threshold for 5 consecutive minutes
ERROR — p95 latency exceeds "Critical" threshold for 2 consecutive minutes
WARN  — Error rate > 5% over rolling 15-minute window
ERROR — Error rate > 15% over rolling 5-minute window
WARN  — Whisper timeout rate > 3% over rolling 30 minutes
```

---

## 7. Appendix: Performance Logging Reference

All performance log lines emitted by `route.ts`:

| Log Tag | When | Fields |
|---------|------|--------|
| `[tutor:perf] Whisper transcription complete` | After Whisper returns | `duration_ms`, `transcribed_length` |
| `[tutor:perf] Audio correction pipeline complete` | After full audio pipeline | `total_ms`, `whisper_ms`, `gpt_ms`, `confidence`, `has_errors` |
| `[tutor:perf] Text/OCR correction pipeline complete` | After text or OCR pipeline | `workflow`, `total_ms`, `gpt_ms`, `inputLength`, `hasErrors` |
| `[tutor:audio:init]` | Before Whisper call | `endpoint`, `deployment`, `url`, `blobSize`, `filename` |
| `[tutor:audio:response]` | After Whisper HTTP response | `status`, `statusText`, `contentType` |
| `[tutor:gpt] Calling ...` | Before GPT call | `userMessageLength`, `timeout` |
| `[tutor:gpt] Response received` | After GPT response | `contentLength`, `hasJSON` |
