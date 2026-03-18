// ─── Subscription Status ──────────────────────────────────────────────────────
// GET → current user's tier, status, quota usage for today

import { NextRequest, NextResponse } from 'next/server';
import { withApiGuard } from '@/lib/api-guard';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const GET = withApiGuard(
  async (_req: NextRequest, ctx) => {
    const userId = ctx.user!.id;
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [subResult, quotaResult] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('tier, status, current_period_end, cancel_at_period_end')
        .eq('user_id', userId)
        .single(),
      supabase
        .from('usage_quotas')
        .select('quota_type, used_today, reset_at')
        .eq('user_id', userId),
    ]);

    const tier = subResult.data?.tier ?? 'free';
    const quotas = (quotaResult.data ?? []) as Array<{
      quota_type: string;
      used_today: number;
      reset_at: string;
    }>;

    // Get limits for this tier
    const { data: limits } = await supabase.rpc('get_tier_limits', { p_tier: tier });

    return NextResponse.json({
      tier,
      status: subResult.data?.status ?? 'active',
      current_period_end: subResult.data?.current_period_end ?? null,
      cancel_at_period_end: subResult.data?.cancel_at_period_end ?? false,
      limits: limits ?? {},
      usage: Object.fromEntries(quotas.map(q => [q.quota_type, q.used_today])),
    });
  },
  { requireAuth: true, rateLimit: { requests: 30, window: 60 } }
);
