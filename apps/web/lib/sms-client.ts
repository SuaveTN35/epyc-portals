// Browser helpers that ask the server to send SMS. Fire and forget: a text
// failing must never block or fail the dispatch or driver action.

function post(url: string, body: unknown) {
  try {
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // ignore
  }
}

export function requestOfferTexts(deliveryId: string, driverIds: string[]) {
  if (driverIds.length > 0) post('/api/dispatch/sms/offer', { delivery_id: deliveryId, driver_ids: driverIds });
}

export function requestAssignedText(deliveryId: string) {
  post('/api/dispatch/sms/assigned', { delivery_id: deliveryId });
}

export function requestProblemAlert(deliveryId: string, reason: string) {
  post(`/api/driver/deliveries/${encodeURIComponent(deliveryId)}/problem-alert`, { reason });
}
