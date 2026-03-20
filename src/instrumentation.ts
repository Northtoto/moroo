/**
 * Next.js Instrumentation Hook
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Runs ONCE when the server starts. Used for:
 * - Environment variable validation (catch config errors at deploy, not at first request)
 * - Startup health logging
 */

export async function register() {
  // ── Sentry initialisation (must be first) ────────────────────────────────
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }

  // Only run on the server (not edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('@/lib/env-check');
    const result = validateEnv();

    if (!result.valid) {
      console.error(
        `[startup] ⛔ ${result.missing.length} required env vars missing — some features will fail`
      );
    } else {
      console.log('[startup] ✅ All required environment variables are set');
    }
  }
}
