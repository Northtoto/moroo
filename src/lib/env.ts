/**
 * env.ts — Server-side environment validation
 *
 * This module is imported by API routes that need validated env vars.
 * It throws at module-load time (i.e., on first request) if any required
 * variable is missing, giving a clear error instead of a silent failure deep
 * in the call stack.
 *
 * Usage:
 *   import { env } from '@/lib/env';
 *   const stripe = new Stripe(env.STRIPE_SECRET_KEY);
 *
 * Client-side vars (NEXT_PUBLIC_*) are NOT validated here — Next.js bakes
 * them in at build time. Check the build output or Vercel env config for those.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[env] Missing required environment variable: ${name}\n` +
      `See .env.example for setup instructions.`
    );
  }
  return value;
}

function optionalEnv(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

// ── Validated server-side environment ─────────────────────────────────────────
// These are only available in server components / API routes (not the browser).
export const env = {
  // Supabase
  SUPABASE_SERVICE_ROLE_KEY: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),

  // Azure OpenAI
  AZURE_OPENAI_ENDPOINT:           requireEnv('AZURE_OPENAI_ENDPOINT'),
  AZURE_OPENAI_API_KEY:            requireEnv('AZURE_OPENAI_API_KEY'),
  AZURE_OPENAI_API_VERSION:        requireEnv('AZURE_OPENAI_API_VERSION'),
  AZURE_OPENAI_GPT_DEPLOYMENT:     requireEnv('AZURE_OPENAI_GPT_DEPLOYMENT'),
  AZURE_OPENAI_WHISPER_DEPLOYMENT: requireEnv('AZURE_OPENAI_WHISPER_DEPLOYMENT'),

  // Stripe
  STRIPE_SECRET_KEY:      requireEnv('STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET:  requireEnv('STRIPE_WEBHOOK_SECRET'),
  STRIPE_PRICE_PRO:       optionalEnv('STRIPE_PRICE_PRO'),
  STRIPE_PRICE_PREMIUM:   optionalEnv('STRIPE_PRICE_PREMIUM'),

  // Internal security
  GWS_INTERNAL_SECRET: requireEnv('GWS_INTERNAL_SECRET'),

  // Optional services
  OPENROUTER_API_KEY:  optionalEnv('OPENROUTER_API_KEY'),
  OPENROUTER_MODEL:    optionalEnv('OPENROUTER_MODEL', 'openai/gpt-4o'),
  UPSTASH_REDIS_REST_URL:   optionalEnv('UPSTASH_REDIS_REST_URL'),
  UPSTASH_REDIS_REST_TOKEN: optionalEnv('UPSTASH_REDIS_REST_TOKEN'),
  GMAIL_FROM_ADDRESS:  optionalEnv('GMAIL_FROM_ADDRESS', 'noreply@morodeutsch.com'),
  SENTRY_DSN:          optionalEnv('SENTRY_DSN'),
  METRICS_API_KEY:     optionalEnv('METRICS_API_KEY'),
} as const;

export type Env = typeof env;
