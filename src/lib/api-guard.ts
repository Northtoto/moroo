// ─── API Guard — Unified Route Protection ────────────────────────────────────
// HOF wrapper for Next.js App Router route handlers.
// Applies: JWT auth → rate limit → quota check → then calls handler.
// Usage:
//   export const POST = withApiGuard(async (req, ctx) => {
//     const { user } = ctx; // pre-validated user
//     ...
//   }, { requireAuth: true, rateLimit: { requests: 60, window: 60 }, quota: 'text' })

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/redis-rate-limiter';
import { z } from 'zod';

// ─── Types ───────────────────────────────────────────────────────────────────

export type QuotaType = 'text' | 'audio' | 'ocr' | 'voice';

export interface ApiGuardOptions {
  requireAuth?: boolean;
  rateLimit?: {
    requests: number;  // max requests
    window: number;    // seconds
  };
  quota?: QuotaType;
  bodySchema?: z.ZodSchema;
}

export interface ApiContext {
  user: User | null;
  tier: string;
  quotaResult?: { allowed: boolean; current: number; limit: number };
  validatedBody?: unknown;
}

type GuardedHandler = (req: NextRequest, ctx: ApiContext) => Promise<NextResponse>;

// ─── Log security event ──────────────────────────────────────────────────────

async function logSecurityEvent(
  event: string,
  userId: string | null,
  ip: string,
  detail?: Record<string, unknown>
): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;

    const supabase = createServiceClient(url, key);
    await supabase.from('security_events').insert({
      event_type: event,
      user_id: userId,
      ip_address: ip,
      metadata: detail ?? {},
      created_at: new Date().toISOString(),
    });
  } catch {
    // Non-critical
  }
}

// ─── Get user IP ─────────────────────────────────────────────────────────────

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

// ─── withApiGuard HOF ─────────────────────────────────────────────────────────

export function withApiGuard(handler: GuardedHandler, options: ApiGuardOptions = {}) {
  return async function guardedHandler(req: NextRequest): Promise<NextResponse> {
    const {
      requireAuth = true,
      rateLimit,
      quota,
      bodySchema,
    } = options;

    const ip = getClientIP(req);
    let user: User | null = null;
    let tier = 'free';

    // ── 1. JWT Authentication ──────────────────────────────────────────────
    if (requireAuth) {
      try {
        const supabase = await createClient();
        const { data: { user: authUser }, error } = await supabase.auth.getUser();

        if (error || !authUser) {
          await logSecurityEvent('auth_failed', null, ip, { path: req.nextUrl.pathname });
          return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }
        user = authUser;
      } catch {
        return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
      }
    }

    // ── 2. Rate Limiting ───────────────────────────────────────────────────
    if (rateLimit) {
      const rateLimitKey = `${user?.id ?? ip}:${req.nextUrl.pathname}`;
      const allowed = await checkRateLimit(rateLimitKey, rateLimit.requests, rateLimit.window);

      if (!allowed) {
        await logSecurityEvent('rate_limit_exceeded', user?.id ?? null, ip, {
          path: req.nextUrl.pathname,
          limit: rateLimit.requests,
          window: rateLimit.window,
        });
        return NextResponse.json(
          { error: 'Too many requests. Please slow down.', retryAfter: rateLimit.window },
          {
            status: 429,
            headers: {
              'Retry-After': String(rateLimit.window),
              'X-RateLimit-Limit': String(rateLimit.requests),
            },
          }
        );
      }
    }

    // ── 3. Quota Check (tier-based usage limits) ──────────────────────────
    let quotaResult: ApiContext['quotaResult'];

    if (quota && user) {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (url && key) {
          const serviceClient = createServiceClient(url, key);
          const { data, error } = await serviceClient.rpc('check_and_increment_quota', {
            p_user_id: user.id,
            p_type: quota,
          });

          if (!error && data) {
            quotaResult = data as { allowed: boolean; current: number; limit: number };
            tier = (data as { tier?: string }).tier ?? 'free';

            if (!quotaResult.allowed) {
              return NextResponse.json(
                {
                  error: 'Daily limit reached',
                  quota: quotaResult,
                  upgrade_url: '/pricing',
                  message: `You've used ${quotaResult.current}/${quotaResult.limit} ${quota} corrections today. Upgrade to PRO for more.`,
                },
                { status: 429 }
              );
            }
          }
        }
      } catch (err) {
        console.error('[api-guard] quota check error:', err);
        // Fail open — don't block on quota errors
      }
    }

    // ── 4. Request Body Validation ────────────────────────────────────────
    let validatedBody: unknown;

    if (bodySchema) {
      try {
        const rawBody = await req.json();
        const result = bodySchema.safeParse(rawBody);

        if (!result.success) {
          return NextResponse.json(
            {
              error: 'Invalid request body',
              details: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
            },
            { status: 400 }
          );
        }
        validatedBody = result.data;
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }
    }

    // ── 5. Call the actual handler ─────────────────────────────────────────
    const ctx: ApiContext = { user, tier, quotaResult, validatedBody };

    try {
      return await handler(req, ctx);
    } catch (err: unknown) {
      console.error('[api-guard] handler error:', err);
      await logSecurityEvent('handler_error', user?.id ?? null, ip, {
        path: req.nextUrl.pathname,
        error: err instanceof Error ? err.message : 'unknown',
      });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}

// ─── Zod schemas for common API inputs ───────────────────────────────────────

export const TextCorrectionSchema = z.object({
  text: z.string().min(1, 'Text required').max(2000, 'Text too long (max 2000 chars)'),
  session_id: z.string().uuid().optional(),
});

export const AudioCorrectionSchema = z.object({
  audio_base64: z.string().min(1),
  session_id: z.string().uuid().optional(),
});

export const FlashcardReviewSchema = z.object({
  card_id: z.string().uuid(),
  rating: z.number().int().min(1).max(4),
});

export const ExportSchema = z.object({
  user_id: z.string().uuid().optional(),
}).optional().default({});
