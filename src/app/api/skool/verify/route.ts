import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const SKOOL_SECRET = process.env.SKOOL_WEBHOOK_SECRET;
  if (!SKOOL_SECRET) {
    logger.error('skool.verify.misconfigured', undefined, { reason: 'SKOOL_WEBHOOK_SECRET not set' });
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  let body: { email?: string; secret?: string; granted_by?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { email, secret, granted_by = 'zapier' } = body;

  if (!email || !secret) {
    return NextResponse.json({ error: 'email and secret required' }, { status: 400 });
  }

  // Constant-time comparison — prevents timing side-channel attacks
  const a = Buffer.from(SKOOL_SECRET);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    logger.warn('skool.verify.unauthorized', { email });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const normalised = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  const supabase = serviceClient();

  // 1. Upsert into allowlist (idempotent — Zapier may call twice)
  const { error: listErr } = await supabase
    .from('skool_verified_emails')
    .upsert(
      { email: normalised, verified_at: new Date().toISOString(), granted_by },
      { onConflict: 'email' }
    );

  if (listErr) {
    logger.error('skool.verify.allowlist_error', listErr);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  // 2. Find existing user by email
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', normalised)
    .single();

  if (!profile) {
    // Not registered yet — allowlist entry is enough
    // handle_new_user() trigger will grant premium at signup
    logger.info('skool.verify.pre_authorized', { email: normalised });
    return NextResponse.json({ status: 'pre_authorized', email: normalised });
  }

  // 3. Upgrade existing profile
  await supabase.from('profiles').update({
    skool_member: true,
    skool_verified_at: new Date().toISOString(),
    signup_source: 'skool',
    subscription_tier: 'premium',
  }).eq('id', profile.id);

  // 4. Upsert subscriptions row (mirrors Stripe webhook pattern)
  await supabase.from('subscriptions').upsert(
    {
      user_id: profile.id,
      tier: 'premium',
      status: 'active',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  logger.info('skool.verify.upgraded', { email: normalised, userId: profile.id });
  return NextResponse.json({ status: 'upgraded', email: normalised, userId: profile.id });
}
