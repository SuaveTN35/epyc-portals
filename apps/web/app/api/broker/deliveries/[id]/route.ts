import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateBroker, AuthError } from '@/lib/broker/auth';

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateBroker(request);
    const { id } = await params;
    const supabase = getServiceSupabase();

    // Look up broker delivery by delivery_id or broker_job_id
    const { data: brokerDelivery } = await supabase
      .from('broker_deliveries')
      .select('delivery_id, broker_job_id')
      .eq('broker_id', auth.broker.id)
      .or(`delivery_id.eq.${id},broker_job_id.eq.${id}`)
      .single();

    if (!brokerDelivery) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Delivery not found' },
        },
        { status: 404 }
      );
    }

    // Fetch delivery details
    const { data: delivery, error } = await supabase
      .from('deliveries')
      .select(`
        id,
        tracking_number,
        status,
        service_level,
        pickup_address,
        pickup_city,
        pickup_state,
        pickup_zip,
        pickup_contact_name,
        delivery_address,
        delivery_city,
        delivery_state,
        delivery_zip,
        delivery_contact_name,
        distance_miles,
        total_price,
        driver_payout,
        actual_pickup_time,
        actual_delivery_time,
        created_at,
        updated_at
      `)
      .eq('id', brokerDelivery.delivery_id)
      .single();

    if (error || !delivery) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Delivery not found' },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...delivery,
        broker_job_id: brokerDelivery.broker_job_id,
      },
    });
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

    console.error('Broker delivery lookup error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      },
      { status: 500 }
    );
  }
}
