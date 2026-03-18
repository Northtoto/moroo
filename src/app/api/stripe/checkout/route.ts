// ─── Stripe Checkout Session ──────────────────────────────────────────────────
// POST { price_id } → returns { url } to redirect user to Stripe Checkout
// Idempotent: reuses existing incomplete session for same customer + price

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('[stripe:checkout] STRIPE_SECRET_KEY is not set — Stripe routes will fail');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_missing', {
  apiVersion: '2026-02-25.clover',
});

const CheckoutSchema = z.object({
  price_id: z.string().startsWith('price_'),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CheckoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid price_id' }, { status: 400 });
    }
    const { price_id } = parsed.data;

    // Look up or create Stripe customer ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id as string | undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: price_id, quantity: 1 }],
      mode: 'subscription',
      success_url: `${appUrl}/pricing?success=1`,
      cancel_url: `${appUrl}/pricing?canceled=1`,
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/checkout] error:', err);
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
  }
}
