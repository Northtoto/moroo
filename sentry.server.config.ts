// ─── Sentry Server-Side Configuration ────────────────────────────────────────
// Captures API crashes, tutor pipeline failures, Whisper errors, and OCR failures.
// This file runs in the Node.js server runtime (API routes, Server Components).

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // ── Sampling ──────────────────────────────────────────────────────────────
  // 100% of errors captured; 10% of traces (adjust upward in staging)
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  sampleRate: 1.0, // always capture errors

  // ── Environment ───────────────────────────────────────────────────────────
  environment: process.env.NODE_ENV ?? 'development',
  release: process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA,

  // ── Tutor pipeline error fingerprinting ──────────────────────────────────
  // Groups related errors by their source pipeline instead of stack trace
  beforeSend(event, hint) {
    const error = hint?.originalException;
    if (!(error instanceof Error)) return event;

    const msg = error.message;

    // Whisper / audio pipeline
    if (msg.includes('TRANSCRIPTION') || msg.includes('EMPTY_TRANSCRIPTION')) {
      event.fingerprint = ['tutor', 'whisper', 'transcription-failed'];
      event.tags = { ...event.tags, pipeline: 'audio', component: 'whisper' };
    }
    // GPT correction pipeline
    else if (msg.includes('GPT_FAILED') || msg.includes('INVALID_JSON_RESPONSE')) {
      event.fingerprint = ['tutor', 'gpt', 'correction-failed'];
      event.tags = { ...event.tags, pipeline: 'correction', component: 'gpt' };
    }
    // TTS pipeline
    else if (msg.includes('tts') || msg.includes('Text-to-speech')) {
      event.fingerprint = ['tutor', 'tts', 'synthesis-failed'];
      event.tags = { ...event.tags, pipeline: 'tts', component: 'azure-speech' };
    }
    // Timeout errors
    else if (msg.includes('TIMEOUT') || error.name === 'AbortError') {
      event.fingerprint = ['tutor', 'timeout', event.tags?.component as string ?? 'unknown'];
      event.tags = { ...event.tags, error_type: 'timeout' };
    }

    return event;
  },

  // ── Ignored errors ────────────────────────────────────────────────────────
  ignoreErrors: [
    // Rate limiting is expected behaviour, not an error
    'RATE_LIMIT',
    // User cancelled request
    'AbortError',
  ],

  // ── Integrations ─────────────────────────────────────────────────────────
  integrations: [
    // HTTP request tracing (captures latency for all API routes)
    Sentry.httpIntegration(),
  ],
});
