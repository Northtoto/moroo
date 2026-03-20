// ─── Sentry Client-Side Configuration ────────────────────────────────────────
// Captures frontend errors: UI crashes, failed API calls seen from the browser.

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // ── Sampling ──────────────────────────────────────────────────────────────
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,
  sampleRate: 1.0,

  // ── Environment ───────────────────────────────────────────────────────────
  environment: process.env.NODE_ENV ?? 'development',
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

  // ── Session replay for debugging UI issues ────────────────────────────────
  // Records 1% of sessions normally, 100% of sessions that had an error
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      // Mask user-typed content to protect privacy
      maskAllText: false,
      maskAllInputs: true,
      blockAllMedia: false,
    }),
    // Captures browser performance (LCP, FID, CLS)
    Sentry.browserTracingIntegration(),
  ],

  // ── Ignored client errors ─────────────────────────────────────────────────
  ignoreErrors: [
    // Browser extensions that inject errors
    'ResizeObserver loop',
    'Non-Error exception captured',
    // Network errors that are expected (offline, adblockers)
    'Failed to fetch',
    'NetworkError',
    'Load failed',
  ],
});
