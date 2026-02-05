import { createClient } from '@supabase/supabase-js';
import type { Delivery, Broker, BrokerDelivery } from '@epyc/shared/types';
import { getAdapter } from './adapters';

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function sendStatusCallback(
  deliveryId: string,
  event: string
): Promise<void> {
  const supabase = getServiceSupabase();

  // Find broker delivery mapping
  const { data: brokerDelivery, error: bdError } = await supabase
    .from('broker_deliveries')
    .select('*, broker:brokers(*)')
    .eq('delivery_id', deliveryId)
    .single();

  if (bdError || !brokerDelivery) {
    // Not a broker delivery, skip
    return;
  }

  const broker = brokerDelivery.broker as Broker;

  if (!broker.callback_url) {
    return;
  }

  // Check if this event should trigger a callback
  if (!broker.callback_events?.includes(event)) {
    return;
  }

  // Fetch full delivery data
  const { data: delivery, error: delError } = await supabase
    .from('deliveries')
    .select('*')
    .eq('id', deliveryId)
    .single();

  if (delError || !delivery) {
    console.error(`Failed to fetch delivery ${deliveryId} for callback:`, delError);
    return;
  }

  // Format the status update using the broker's adapter
  const adapter = getAdapter(broker.type);
  const payload = adapter.formatStatusUpdate(delivery as Delivery, event);

  const startTime = Date.now();
  let responseStatus: number | undefined;
  let responseBody: unknown;
  let callbackError: string | undefined;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'EPYC-Courier/1.0',
      'X-EPYC-Event': event,
      'X-EPYC-Delivery-Id': deliveryId,
      ...(broker.callback_headers || {}),
    };

    const response = await fetch(broker.callback_url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    responseStatus = response.status;

    try {
      responseBody = await response.json();
    } catch {
      responseBody = await response.text();
    }

    if (!response.ok) {
      callbackError = `HTTP ${response.status}: ${typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody)}`;
    }
  } catch (err) {
    callbackError = err instanceof Error ? err.message : 'Unknown error';
    responseStatus = 0;
  }

  const processingTime = Date.now() - startTime;

  // Update broker_deliveries record
  await supabase
    .from('broker_deliveries')
    .update({
      last_status_sent: event,
      last_callback_at: new Date().toISOString(),
      last_callback_status: responseStatus,
      callback_attempts: (brokerDelivery as BrokerDelivery).callback_attempts + 1,
      callback_error: callbackError || null,
    })
    .eq('id', brokerDelivery.id);

  // Log the webhook
  await supabase.from('broker_webhook_logs').insert({
    broker_id: broker.id,
    direction: 'outbound',
    endpoint: broker.callback_url,
    request_body: payload as Record<string, unknown>,
    response_status: responseStatus,
    response_body: typeof responseBody === 'object' ? responseBody : { text: responseBody },
    processing_time_ms: processingTime,
    error: callbackError,
  });
}
