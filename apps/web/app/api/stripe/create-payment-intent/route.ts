import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

interface CreatePaymentIntentRequest {
  amount: number; // Amount in cents
  delivery_id: string;
  metadata?: Record<string, string>;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreatePaymentIntentRequest = await request.json();
    const { amount, delivery_id, metadata = {} } = body;

    // Validate amount
    if (!amount || amount < 100) {
      return NextResponse.json(
        { error: 'Invalid amount. Minimum is $1.00 (100 cents)' },
        { status: 400 }
      );
    }

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
    if (!['booked', 'quoted'].includes(delivery.status)) {
      return NextResponse.json(
        { error: 'This delivery cannot be paid for in its current status' },
        { status: 400 }
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
      amount,
      currency: 'usd',
      customer: stripeCustomerId,
      metadata: {
        delivery_id,
        tracking_number: delivery.tracking_number,
        user_id: user.id,
        ...metadata,
      },
      automatic_payment_methods: {
        enabled: true,
      },
      description: `EPYC Courier - Delivery ${delivery.tracking_number}`,
    });

    // Create payment record in database
    await supabase.from('payments').insert({
      delivery_id,
      customer_id: user.id,
      amount: amount / 100, // Convert cents to dollars for storage
      currency: 'usd',
      status: 'pending',
      stripe_payment_intent_id: paymentIntent.id,
    });

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
