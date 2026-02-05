import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateBroker, AuthError } from '@/lib/broker/auth';
import { sendStatusCallback } from '@/lib/broker/callbacks';

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const CANCELLABLE_STATUSES = ['booked', 'assigned', 'en_route_pickup'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateBroker(request);
    const { id } = await params;
    const supabase = getServiceSupabase();

    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = body.reason;
    } catch {
      // Body is optional for cancel
    }

    // Look up broker delivery
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

    // Check current status
    const { data: delivery } = await supabase
      .from('deliveries')
      .select('id, status, tracking_number')
      .eq('id', brokerDelivery.delivery_id)
      .single();

    if (!delivery) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Delivery not found' },
        },
        { status: 404 }
      );
    }

    if (!CANCELLABLE_STATUSES.includes(delivery.status)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_CANCELLABLE',
            message: `Delivery cannot be cancelled in '${delivery.status}' status. Cancellable statuses: ${CANCELLABLE_STATUSES.join(', ')}`,
          },
        },
        { status: 409 }
      );
    }

    // Cancel the delivery
    const { error: updateError } = await supabase
      .from('deliveries')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', delivery.id);

    if (updateError) {
      console.error('Failed to cancel delivery:', updateError);
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UPDATE_FAILED', message: 'Failed to cancel delivery' },
        },
        { status: 500 }
      );
    }

    // If driver was assigned, free them up
    if (delivery.status === 'assigned' || delivery.status === 'en_route_pickup') {
      await supabase
        .from('drivers')
        .update({ current_delivery_id: null })
        .eq('current_delivery_id', delivery.id);
    }

    // Create delivery event
    await supabase.from('delivery_events').insert({
      delivery_id: delivery.id,
      event_type: 'cancelled',
      old_status: delivery.status,
      new_status: 'cancelled',
      notes: reason
        ? `Cancelled by broker: ${reason}`
        : `Cancelled by broker: ${auth.broker.name}`,
    });

    // Send status callback
    sendStatusCallback(delivery.id, 'cancelled').catch((err) => {
      console.error('Callback error:', err);
    });

    // Log webhook
    await supabase.from('broker_webhook_logs').insert({
      broker_id: auth.broker.id,
      direction: 'inbound',
      endpoint: `/api/broker/deliveries/${id}/cancel`,
      request_body: { reason },
      response_status: 200,
      processing_time_ms: 0,
    });

    return NextResponse.json({
      success: true,
      data: {
        delivery_id: delivery.id,
        tracking_number: delivery.tracking_number,
        status: 'cancelled',
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

    console.error('Broker delivery cancel error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      },
      { status: 500 }
    );
  }
}
