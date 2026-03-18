// ─── Stripe Webhook Handler ───────────────────────────────────────────────────
// Receives Stripe events, verifies signature, updates Supabase subscriptions.
// Idempotent: processed_stripe_events table prevents double-processing.
//
// Handled events:
//   checkout.session.completed      → activate subscription
//   customer.subscription.updated   → update tier / status
//   customer.subscription.deleted   → downgrade to free
//   invoice.payment_failed          → mark past_due

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient as createServiceClient } from '@supabase/supabase-js';

if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
  console.error('[stripe:webhook] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is not set');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_missing', {
  apiVersion: '2026-02-25.clover',
});

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Map Stripe price IDs to internal tiers
const PRICE_TO_TIER: Record<string, string> = {
  [process.env.STRIPE_PRICE_PRO ?? '']: 'pro',
  [process.env.STRIPE_PRICE_PREMIUM ?? '']: 'premium',
};

function tierFromPriceId(priceId: string): string {
  return PRICE_TO_TIER[priceId] ?? 'free';
}

async function isAlreadyProcessed(supabase: ReturnType<typeof getServiceClient>, eventId: string): Promise<boolean> {
  const { data } = await supabase
    .from('processed_stripe_events')
    .select('id')
    .eq('stripe_event_id', eventId)
    .single();
  return !!data;
}

async function markProcessed(supabase: ReturnType<typeof getServiceClient>, eventId: string): Promise<void> {
  await supabase
    .from('processed_stripe_events')
    .insert({ stripe_event_id: eventId, processed_at: new Date().toISOString() });
}

async function upsertSubscription(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  subscription: Stripe.Subscription
): Promise<void> {
  const priceId = subscription.items.data[0]?.price.id ?? '';
  const tier = tierFromPriceId(priceId);

  await supabase.from('subscriptions').upsert({
    user_id: userId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
    stripe_price_id: priceId,
    tier,
    status: subscription.status,
    current_period_start: new Date(((subscription as unknown as Record<string, number>).current_period_start) * 1000).toISOString(),
    current_period_end: new Date(((subscription as unknown as Record<string, number>).current_period_end) * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig || !WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe/webhook] signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Idempotency guard
  if (await isAlreadyProcessed(supabase, event.id)) {
    return NextResponse.json({ received: true, skipped: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription' || !session.subscription) break;

        const userId = session.metadata?.supabase_user_id ??
          (await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', session.customer as string)
            .single()
          ).data?.id;

        if (!userId) break;

        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await upsertSubscription(supabase, userId, subscription);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id ??
          (await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_subscription_id', subscription.id)
            .single()
          ).data?.user_id;

        if (!userId) break;
        await upsertSubscription(supabase, userId, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await supabase
          .from('subscriptions')
          .update({ tier: 'free', status: 'canceled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceSubscriptionId = (invoice as unknown as Record<string, unknown>).subscription as string | undefined;
        if (invoiceSubscriptionId) {
          await supabase
            .from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', invoiceSubscriptionId);
        }
        break;
      }
    }

    await markProcessed(supabase, event.id);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[stripe/webhook] handler error:', err);
    // Return 500 so Stripe retries with exponential backoff.
    // The processed_stripe_events idempotency guard prevents double-processing.
    return NextResponse.json({ error: 'Internal processing error' }, { status: 500 });
  }
}
