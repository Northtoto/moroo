/**
 * Centralized environment variable validation.
 *
 * Import this in layout.tsx or instrumentation.ts to catch missing
 * config at startup instead of at first request.
 *
 * ★ SECURITY: Never log the actual values — only whether they're set.
 */

type EnvVar = {
  name: string;
  required: boolean;
  hint: string;
};

const ENV_VARS: EnvVar[] = [
  // ── Supabase (always required) ──────────────────────────────────────
  { name: 'NEXT_PUBLIC_SUPABASE_URL', required: true, hint: 'Supabase project URL' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', required: true, hint: 'Supabase anonymous key' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', required: true, hint: 'Supabase service role key (server-side only)' },

  // ── Azure OpenAI (required for tutor) ───────────────────────────────
  { name: 'AZURE_OPENAI_ENDPOINT', required: true, hint: 'Azure OpenAI endpoint URL' },
  { name: 'AZURE_OPENAI_API_KEY', required: true, hint: 'Azure OpenAI API key' },

  // ── Stripe (required for payments) ──────────────────────────────────
  { name: 'STRIPE_SECRET_KEY', required: false, hint: 'Stripe secret key — payments disabled if missing' },
  { name: 'STRIPE_WEBHOOK_SECRET', required: false, hint: 'Stripe webhook signing secret' },

  // ── Redis (optional — falls back to in-memory rate limiter) ─────────
  { name: 'UPSTASH_REDIS_REST_URL', required: false, hint: 'Upstash Redis URL for rate limiting' },
  { name: 'UPSTASH_REDIS_REST_TOKEN', required: false, hint: 'Upstash Redis auth token' },
];

export function validateEnv(): { valid: boolean; missing: string[]; warnings: string[] } {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const { name, required, hint } of ENV_VARS) {
    const value = process.env[name];
    if (!value || value.trim() === '') {
      if (required) {
        missing.push(`❌ ${name} — ${hint}`);
      } else {
        warnings.push(`⚠️  ${name} — ${hint}`);
      }
    }
  }

  if (missing.length > 0) {
    console.error('\n╔══════════════════════════════════════════════════════════╗');
    console.error('║  MORODEUTSCH — MISSING REQUIRED ENVIRONMENT VARIABLES   ║');
    console.error('╚══════════════════════════════════════════════════════════╝\n');
    missing.forEach((m) => console.error(`  ${m}`));
    console.error('');
  }

  if (warnings.length > 0) {
    console.warn('\n  Optional env vars not set (features will be degraded):');
    warnings.forEach((w) => console.warn(`  ${w}`));
    console.warn('');
  }

  return { valid: missing.length === 0, missing, warnings };
}
