import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateBroker, AuthError } from '@/lib/broker/auth';
import { getAdapter } from '@/lib/broker/adapters';
import { generateTrackingNumber, calculateQuote } from '@epyc/shared/utils';
import type { QuoteRequest } from '@epyc/shared/types';

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const supabase = getServiceSupabase();

  let brokerId: string | undefined;

  try {
    // Authenticate
    const auth = await authenticateBroker(request);
    brokerId = auth.broker.id;

    // Parse body
    const rawPayload = await request.json();

    // Log inbound webhook
    await supabase.from('broker_webhook_logs').insert({
      broker_id: auth.broker.id,
      direction: 'inbound',
      endpoint: '/api/broker/deliveries',
      request_body: rawPayload,
    });

    // Normalize payload via adapter
    const adapter = getAdapter(auth.broker.type);
    let normalizedJob;
    try {
      normalizedJob = adapter.normalize(rawPayload);
    } catch (err) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: err instanceof Error ? err.message : 'Invalid payload format',
          },
        },
        { status: 422 }
      );
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from('broker_deliveries')
      .select('delivery_id, broker_job_id')
      .eq('broker_id', auth.broker.id)
      .eq('broker_job_id', normalizedJob.broker_job_id)
      .single();

    if (existing) {
      // Return existing delivery info
      const { data: existingDelivery } = await supabase
        .from('deliveries')
        .select('id, tracking_number, status')
        .eq('id', existing.delivery_id)
        .single();

      return NextResponse.json({
        success: true,
        data: {
          delivery_id: existing.delivery_id,
          tracking_number: existingDelivery?.tracking_number,
          status: existingDelivery?.status,
          broker_job_id: normalizedJob.broker_job_id,
          duplicate: true,
        },
      });
    }

    // Find or create a customer profile for this company's API user
    let customerId: string;
    const { data: companyProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('company_id', auth.companyId)
      .in('role', ['customer', 'admin'])
      .limit(1)
      .single();

    if (companyProfile) {
      customerId = companyProfile.id;
    } else {
      // Use company's first profile as fallback
      const { data: anyProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('company_id', auth.companyId)
        .limit(1)
        .single();

      if (!anyProfile) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NO_COMPANY_PROFILE',
              message: 'No user profile found for this company. Create a user account linked to this company first.',
            },
          },
          { status: 400 }
        );
      }
      customerId = anyProfile.id;
    }

    // Calculate pricing
    const trackingNumber = generateTrackingNumber();
    let totalPrice = normalizedJob.broker_price;
    let driverPayout = normalizedJob.broker_payout;
    let distanceMiles: number | undefined;
    let estimatedDuration: number | undefined;

    // If broker didn't provide pricing, calculate it
    if (!totalPrice) {
      const quoteRequest: QuoteRequest = {
        pickup_address: normalizedJob.pickup_address,
        pickup_city: normalizedJob.pickup_city,
        pickup_state: normalizedJob.pickup_state,
        pickup_zip: normalizedJob.pickup_zip,
        delivery_address: normalizedJob.delivery_address,
        delivery_city: normalizedJob.delivery_city,
        delivery_state: normalizedJob.delivery_state,
        delivery_zip: normalizedJob.delivery_zip,
        package_weight: normalizedJob.package_weight,
        service_level: normalizedJob.service_level,
        vehicle_required: normalizedJob.vehicle_required,
        is_medical: normalizedJob.is_medical,
        is_hipaa: normalizedJob.is_hipaa,
        requires_temperature_control: normalizedJob.requires_temperature_control,
        temperature_min: normalizedJob.temperature_min,
        temperature_max: normalizedJob.temperature_max,
      };

      // Use lat/lng if available, otherwise estimate distance from addresses
      let distance = 10; // default 10 miles if can't calculate
      if (normalizedJob.pickup_lat && normalizedJob.pickup_lng &&
          normalizedJob.delivery_lat && normalizedJob.delivery_lng) {
        // Use the Haversine-based calculation
        const { calculateDistance } = await import('@epyc/shared/utils');
        distance = calculateDistance(
          { lat: normalizedJob.pickup_lat, lng: normalizedJob.pickup_lng },
          { lat: normalizedJob.delivery_lat, lng: normalizedJob.delivery_lng }
        ) * 1.3; // Approximate driving distance
      }

      const quote = calculateQuote(quoteRequest, distance);
      totalPrice = quote.total_price;
      driverPayout = quote.driver_payout;
      distanceMiles = quote.distance_miles;
      estimatedDuration = quote.estimated_duration_minutes;
    }

    // Insert delivery
    const { data: delivery, error: deliveryError } = await supabase
      .from('deliveries')
      .insert({
        tracking_number: trackingNumber,
        customer_id: customerId,
        company_id: auth.companyId,
        status: 'booked',

        pickup_address: normalizedJob.pickup_address,
        pickup_city: normalizedJob.pickup_city,
        pickup_state: normalizedJob.pickup_state,
        pickup_zip: normalizedJob.pickup_zip,
        pickup_lat: normalizedJob.pickup_lat,
        pickup_lng: normalizedJob.pickup_lng,
        pickup_contact_name: normalizedJob.pickup_contact_name,
        pickup_contact_phone: normalizedJob.pickup_contact_phone,
        pickup_instructions: normalizedJob.pickup_instructions,
        pickup_window_start: normalizedJob.pickup_window_start,
        pickup_window_end: normalizedJob.pickup_window_end,

        delivery_address: normalizedJob.delivery_address,
        delivery_city: normalizedJob.delivery_city,
        delivery_state: normalizedJob.delivery_state,
        delivery_zip: normalizedJob.delivery_zip,
        delivery_lat: normalizedJob.delivery_lat,
        delivery_lng: normalizedJob.delivery_lng,
        delivery_contact_name: normalizedJob.delivery_contact_name,
        delivery_contact_phone: normalizedJob.delivery_contact_phone,
        delivery_instructions: normalizedJob.delivery_instructions,
        delivery_window_start: normalizedJob.delivery_window_start,
        delivery_window_end: normalizedJob.delivery_window_end,

        package_description: normalizedJob.package_description,
        package_weight: normalizedJob.package_weight,
        requires_signature: normalizedJob.requires_signature ?? true,
        requires_photo_pod: true,
        is_medical: normalizedJob.is_medical ?? false,
        is_hipaa: normalizedJob.is_hipaa ?? false,
        requires_temperature_control: normalizedJob.requires_temperature_control ?? false,
        temperature_min: normalizedJob.temperature_min,
        temperature_max: normalizedJob.temperature_max,

        service_level: normalizedJob.service_level,
        vehicle_required: normalizedJob.vehicle_required,

        distance_miles: distanceMiles,
        estimated_duration_minutes: estimatedDuration,
        total_price: totalPrice,
        driver_payout: driverPayout,
        booked_at: new Date().toISOString(),
      })
      .select('id, tracking_number, status')
      .single();

    if (deliveryError || !delivery) {
      console.error('Failed to create delivery:', deliveryError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DELIVERY_CREATE_FAILED',
            message: 'Failed to create delivery',
          },
        },
        { status: 500 }
      );
    }

    // Insert broker delivery mapping
    await supabase.from('broker_deliveries').insert({
      broker_id: auth.broker.id,
      delivery_id: delivery.id,
      broker_job_id: normalizedJob.broker_job_id,
      broker_reference: normalizedJob.broker_reference,
      raw_payload: rawPayload,
    });

    // Create delivery event
    await supabase.from('delivery_events').insert({
      delivery_id: delivery.id,
      event_type: 'broker_created',
      notes: `Created via broker: ${auth.broker.name} (${auth.broker.type})`,
    });

    // Update webhook log with processing time
    const processingTime = Date.now() - startTime;
    await supabase
      .from('broker_webhook_logs')
      .update({
        response_status: 201,
        processing_time_ms: processingTime,
      })
      .eq('broker_id', auth.broker.id)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(1);

    return NextResponse.json(
      {
        success: true,
        data: {
          delivery_id: delivery.id,
          tracking_number: delivery.tracking_number,
          status: 'booked',
          broker_job_id: normalizedJob.broker_job_id,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'AUTH_FAILED', message: error.message },
        },
        { status: error.statusCode }
      );
    }

    console.error('Broker delivery creation error:', error);

    // Log error
    if (brokerId) {
      await supabase.from('broker_webhook_logs').insert({
        broker_id: brokerId,
        direction: 'inbound',
        endpoint: '/api/broker/deliveries',
        response_status: 500,
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time_ms: Date.now() - startTime,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      },
      { status: 500 }
    );
  }
}
