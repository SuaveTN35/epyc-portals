import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { formatCents, nextPaymentStatus, type PaymentStatus } from '@/lib/customer-delivery';

// Lazy initialization to avoid build-time errors
function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || !process.env.STRIPE_SECRET_KEY) {
    console.error('Stripe webhook is not configured (STRIPE_WEBHOOK_SECRET / STRIPE_SECRET_KEY)');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }
  const stripe = getStripe();
  const supabase = getSupabase();

  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSuccess(supabase, paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailure(supabase, paymentIntent);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await handleRefund(supabase, charge);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// Payment state lives in public.payments only. deliveries has no payment
// columns live, and delivery_events has no description/metadata columns, so
// the timeline gets event_type + notes. Live payments columns: id,
// delivery_id, customer_id, stripe_payment_intent_id, stripe_charge_id,
// amount, tip_amount, status, paid_at, created_at.

interface PaymentRecord {
  id: string;
  delivery_id: string;
  status: PaymentStatus | null;
}

/**
 * Moves the payments row for a PaymentIntent to `status`. Creates the row
 * when create-payment-intent never wrote one (or a later intent replaced it).
 * Returns the delivery id when the status actually changed, so the caller
 * logs one timeline event per real change even if Stripe retries.
 */
async function recordPaymentStatus(
  supabase: SupabaseClient,
  args: {
    paymentIntentId: string;
    deliveryIdHint: string | null;
    status: PaymentStatus;
    amountCents: number | null;
    chargeId?: string | null;
    paidAt?: string | null;
  }
): Promise<string | null> {
  const { data: existing, error: readError } = await supabase
    .from('payments')
    .select('id, delivery_id, status')
    .eq('stripe_payment_intent_id', args.paymentIntentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<PaymentRecord>();
  if (readError) {
    throw new Error(`payments read failed: ${readError.message}`);
  }

  if (existing) {
    const next = nextPaymentStatus(existing.status, args.status);
    if (!next) return null;
    const patch: Record<string, unknown> = { status: next };
    if (args.chargeId) patch.stripe_charge_id = args.chargeId;
    if (args.paidAt) patch.paid_at = args.paidAt;
    const { error } = await supabase.from('payments').update(patch).eq('id', existing.id);
    if (error) throw new Error(`payments update failed: ${error.message}`);
    return existing.delivery_id;
  }

  if (!args.deliveryIdHint) {
    console.error('No payments row and no delivery_id for intent', args.paymentIntentId);
    return null;
  }
  // customer_id comes from the delivery, not from Stripe metadata.
  const { data: delivery } = await supabase
    .from('deliveries')
    .select('id, customer_id')
    .eq('id', args.deliveryIdHint)
    .maybeSingle();
  if (!delivery || args.amountCents == null) {
    console.error('Cannot create payments row for intent', args.paymentIntentId);
    return null;
  }
  const { error } = await supabase.from('payments').insert({
    delivery_id: delivery.id,
    customer_id: delivery.customer_id,
    stripe_payment_intent_id: args.paymentIntentId,
    stripe_charge_id: args.chargeId ?? null,
    amount: args.amountCents / 100,
    status: args.status,
    paid_at: args.paidAt ?? null,
  });
  if (error) throw new Error(`payments insert failed: ${error.message}`);
  return delivery.id;
}

async function logPaymentEvent(
  supabase: SupabaseClient,
  deliveryId: string,
  eventType: 'payment_received' | 'payment_failed' | 'payment_refunded',
  notes: string
) {
  const { error } = await supabase.from('delivery_events').insert({
    delivery_id: deliveryId,
    event_type: eventType,
    notes,
  });
  if (error) {
    console.error('delivery_events insert failed', { deliveryId, eventType, error: error.message });
  }
}

function chargeIdOf(paymentIntent: Stripe.PaymentIntent): string | null {
  const c = paymentIntent.latest_charge;
  if (!c) return null;
  return typeof c === 'string' ? c : c.id;
}

async function handlePaymentSuccess(
  supabase: SupabaseClient,
  paymentIntent: Stripe.PaymentIntent
) {
  const deliveryId = await recordPaymentStatus(supabase, {
    paymentIntentId: paymentIntent.id,
    deliveryIdHint: paymentIntent.metadata?.delivery_id ?? null,
    status: 'succeeded',
    amountCents: paymentIntent.amount_received || paymentIntent.amount,
    chargeId: chargeIdOf(paymentIntent),
    paidAt: new Date().toISOString(),
  });
  if (deliveryId) {
    await logPaymentEvent(
      supabase,
      deliveryId,
      'payment_received',
      `Payment of ${formatCents(paymentIntent.amount_received || paymentIntent.amount)} received`
    );
  }
}

async function handlePaymentFailure(
  supabase: SupabaseClient,
  paymentIntent: Stripe.PaymentIntent
) {
  const deliveryId = await recordPaymentStatus(supabase, {
    paymentIntentId: paymentIntent.id,
    deliveryIdHint: paymentIntent.metadata?.delivery_id ?? null,
    status: 'failed',
    amountCents: paymentIntent.amount,
  });
  if (deliveryId) {
    const reason = paymentIntent.last_payment_error?.message;
    await logPaymentEvent(
      supabase,
      deliveryId,
      'payment_failed',
      reason ? `Payment attempt failed: ${reason}` : 'Payment attempt failed'
    );
  }
}

async function handleRefund(supabase: SupabaseClient, charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  const amount = formatCents(charge.amount_refunded);

  // Partial refund: the payment still stands; note it on the timeline only.
  if (!charge.refunded) {
    const { data: payment } = await supabase
      .from('payments')
      .select('delivery_id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .limit(1)
      .maybeSingle();
    if (payment?.delivery_id) {
      await logPaymentEvent(supabase, payment.delivery_id, 'payment_refunded', `Partial refund of ${amount} processed`);
    }
    return;
  }

  const deliveryId = await recordPaymentStatus(supabase, {
    paymentIntentId,
    deliveryIdHint: charge.metadata?.delivery_id ?? null,
    status: 'refunded',
    amountCents: charge.amount,
    chargeId: charge.id,
  });
  if (deliveryId) {
    await logPaymentEvent(supabase, deliveryId, 'payment_refunded', `Refund of ${amount} processed`);
  }
}
