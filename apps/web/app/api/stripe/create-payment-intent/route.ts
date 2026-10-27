import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, rateLimitHeaders, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { createPaymentIntentSchema, validateRequest } from '@/lib/validations';
import { chargeCents } from '@/lib/customer-delivery';

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Service role client for bypassing RLS (needed for inserting payments)
function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  // Rate limit by IP
  const clientId = getClientIdentifier(request);
  const rateLimitResult = checkRateLimit(`payment:${clientId}`, RATE_LIMITS.api);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: rateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    const supabase = await createServerClient();

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.json();

    // Validate with Zod
    const validation = validateRequest(createPaymentIntentSchema, rawBody);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validation.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        },
        { status: 400 }
      );
    }

    const { amount, delivery_id, metadata = {} } = validation.data;

    // Verify the delivery belongs to this user
    const { data: delivery, error: deliveryError } = await supabase
      .from('deliveries')
      .select('id, tracking_number, total_price, status')
      .eq('id', delivery_id)
      .eq('customer_id', user.id)
      .single();

    if (deliveryError || !delivery) {
      return NextResponse.json(
        { error: 'Delivery not found or unauthorized' },
        { status: 404 }
      );
    }

    // Check if delivery is in a payable status
    if (!['booked', 'quoted', 'assigned'].includes(delivery.status)) {
      return NextResponse.json(
        { error: 'This delivery cannot be paid for in its current status' },
        { status: 400 }
      );
    }

    // The charge is the stored delivery total, never a client-supplied number.
    // The client still sends amount; a mismatch means a stale quote screen.
    // One cent of slack covers float rounding of an unrounded quote total
    // against the numeric(10,2) column.
    const cents = chargeCents(delivery.total_price);
    if (cents == null) {
      return NextResponse.json(
        { error: 'This delivery has no price yet. Call (818) 217-0070.' },
        { status: 400 }
      );
    }
    if (Math.abs(amount - cents) > 1) {
      return NextResponse.json(
        { error: 'The price changed. Go back and review the quote.' },
        { status: 409 }
      );
    }

    // Get or create Stripe customer
    let stripeCustomerId: string;

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profile?.stripe_customer_id) {
      stripeCustomerId = profile.stripe_customer_id;
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });

      stripeCustomerId = customer.id;

      // Save Stripe customer ID to profile
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', user.id);
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: cents,
      currency: 'usd',
      customer: stripeCustomerId,
      // Server values last so request metadata cannot repoint the webhook.
      metadata: {
        ...metadata,
        delivery_id,
        tracking_number: delivery.tracking_number,
        user_id: user.id,
      },
      automatic_payment_methods: {
        enabled: true,
      },
      description: `EPYC Courier - Delivery ${delivery.tracking_number}`,
    });

    // Payment state lives in public.payments (live columns: delivery_id,
    // customer_id, stripe_payment_intent_id, stripe_charge_id, amount,
    // tip_amount, status, paid_at, created_at). Reuse an open row for this
    // delivery so revisiting the payment step does not pile up rows.
    const serviceSupabase = getServiceSupabase();
    const { data: openPayment } = await serviceSupabase
      .from('payments')
      .select('id')
      .eq('delivery_id', delivery_id)
      .eq('customer_id', user.id)
      .in('status', ['pending', 'failed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const paymentRow = {
      amount: cents / 100,
      status: 'pending',
      stripe_payment_intent_id: paymentIntent.id,
    };
    const { error: paymentError } = openPayment
      ? await serviceSupabase.from('payments').update(paymentRow).eq('id', openPayment.id)
      : await serviceSupabase
          .from('payments')
          .insert({ ...paymentRow, delivery_id, customer_id: user.id });
    if (paymentError) {
      console.error('payments write failed', { delivery_id, error: paymentError.message });
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error('Stripe payment intent error:', error);

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}
