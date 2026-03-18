// ─── Stripe Customer Portal ───────────────────────────────────────────────────
// POST → redirect URL to Stripe-hosted billing portal (manage/cancel sub)

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('[stripe:portal] STRIPE_SECRET_KEY is not set');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_missing', {
  apiVersion: '2026-02-25.clover',
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    const customerId = profile?.stripe_customer_id as string | undefined;
    if (!customerId) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/pricing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/portal] error:', err);
    return NextResponse.json({ error: 'Portal session failed' }, { status: 500 });
  }
}
