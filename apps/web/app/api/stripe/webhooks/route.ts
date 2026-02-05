import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
  const stripe = getStripe();
  const supabase = getSupabase();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

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

async function handlePaymentSuccess(
  supabase: SupabaseClient,
  paymentIntent: Stripe.PaymentIntent
) {
  const deliveryId = paymentIntent.metadata?.delivery_id;

  if (!deliveryId) {
    console.error('No delivery_id in payment intent metadata');
    return;
  }

  // Update payment record
  const { error: paymentError } = await supabase
    .from('payments')
    .update({
      status: 'succeeded',
      payment_method: paymentIntent.payment_method_types?.[0] || 'card',
      paid_at: new Date().toISOString(),
    })
    .eq('stripe_payment_intent_id', paymentIntent.id);

  if (paymentError) {
    console.error('Error updating payment:', paymentError);
  }

  // Update delivery status to confirmed/paid
  const { error: deliveryError } = await supabase
    .from('deliveries')
    .update({
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
    })
    .eq('id', deliveryId);

  if (deliveryError) {
    console.error('Error updating delivery:', deliveryError);
  }

  // Create delivery event
  await supabase.from('delivery_events').insert({
    delivery_id: deliveryId,
    event_type: 'payment_received',
    description: `Payment of $${(paymentIntent.amount / 100).toFixed(2)} received`,
    metadata: {
      payment_intent_id: paymentIntent.id,
      amount: paymentIntent.amount,
    },
  });

  console.log(`Payment succeeded for delivery ${deliveryId}`);
}

async function handlePaymentFailure(
  supabase: SupabaseClient,
  paymentIntent: Stripe.PaymentIntent
) {
  const deliveryId = paymentIntent.metadata?.delivery_id;

  // Update payment record
  await supabase
    .from('payments')
    .update({
      status: 'failed',
      error_message: paymentIntent.last_payment_error?.message || 'Payment failed',
    })
    .eq('stripe_payment_intent_id', paymentIntent.id);

  if (deliveryId) {
    // Create delivery event
    await supabase.from('delivery_events').insert({
      delivery_id: deliveryId,
      event_type: 'payment_failed',
      description: 'Payment attempt failed',
      metadata: {
        payment_intent_id: paymentIntent.id,
        error: paymentIntent.last_payment_error?.message,
      },
    });
  }

  console.log(`Payment failed for intent ${paymentIntent.id}`);
}

async function handleRefund(
  supabase: SupabaseClient,
  charge: Stripe.Charge
) {
  const paymentIntentId = charge.payment_intent as string;

  if (!paymentIntentId) return;

  // Get the payment record
  const { data: payment } = await supabase
    .from('payments')
    .select('delivery_id')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .single();

  // Update payment status
  await supabase
    .from('payments')
    .update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
    })
    .eq('stripe_payment_intent_id', paymentIntentId);

  if (payment?.delivery_id) {
    // Update delivery payment status
    await supabase
      .from('deliveries')
      .update({ payment_status: 'refunded' })
      .eq('id', payment.delivery_id);

    // Create delivery event
    await supabase.from('delivery_events').insert({
      delivery_id: payment.delivery_id,
      event_type: 'payment_refunded',
      description: `Refund of $${(charge.amount_refunded / 100).toFixed(2)} processed`,
      metadata: {
        charge_id: charge.id,
        amount_refunded: charge.amount_refunded,
      },
    });
  }

  console.log(`Refund processed for charge ${charge.id}`);
}
