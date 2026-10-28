import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/server/driver-session';
import { isSafeSignatureData, selectCustomerProof, type ProofRow } from '@/lib/customer-delivery';
import { isProofPathForDelivery } from '@/lib/proof-flow';

const SIGNED_URL_SECONDS = 300;

/**
 * GET /api/client/deliveries/:id/proof
 *
 * Proof of delivery for the customer who owns the delivery. Customers have
 * no SELECT on the private delivery-photos bucket, so placement photos are
 * signed here (5 minutes) with the service client after the ownership check.
 * Recipient photos and every pickup-stage row (item photos, receipts) are
 * never returned.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rate = checkRateLimit(`client-proof:${getClientIdentifier(request)}`, RATE_LIMITS.api);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests. Wait a moment.' }, { status: 429 });
  }

  const { id: deliveryId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(deliveryId)) {
    return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
  }

  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in again' }, { status: 401 });
  }

  const admin = createServiceClient();
  const { data: delivery } = await admin
    .from('deliveries')
    .select('id, customer_id, status')
    .eq('id', deliveryId)
    .maybeSingle();
  if (!delivery || delivery.customer_id !== user.id) {
    return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
  }

  const { data: rows, error } = await admin
    .from('proof_of_delivery')
    .select(
      'type, stage, photo_kind, photo_url, signature_data, recipient_name, recipient_relation, notes, captured_at'
    )
    .eq('delivery_id', deliveryId)
    .eq('stage', 'delivery')
    .order('captured_at', { ascending: true });
  if (error) {
    console.error('client proof read failed', { deliveryId, error: error.message });
    return NextResponse.json({ error: 'Could not load proof of delivery' }, { status: 500 });
  }

  const proof = selectCustomerProof((rows ?? []) as ProofRow[]);

  const photos: string[] = [];
  for (const path of proof.placementPaths) {
    // Only paths inside this delivery's own folder are signed (P-358). A full
    // URL, another delivery's folder, or a traversal path is skipped.
    if (!isProofPathForDelivery(delivery.id, path)) continue;
    const { data: signed } = await admin.storage
      .from('delivery-photos')
      .createSignedUrl(path, SIGNED_URL_SECONDS);
    if (signed?.signedUrl) photos.push(signed.signedUrl);
  }

  return NextResponse.json(
    {
      status: delivery.status,
      photos,
      signature: isSafeSignatureData(proof.signatureData) ? proof.signatureData : null,
      recipient_name: proof.recipientName,
      recipient_relation: proof.recipientRelation,
      notes: proof.notes,
      captured_at: proof.capturedAt,
      expires_in: SIGNED_URL_SECONDS,
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
