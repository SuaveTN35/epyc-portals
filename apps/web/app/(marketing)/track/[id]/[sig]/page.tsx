import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CheckCircle2, Circle, Package, Phone } from 'lucide-react';
import { createAdminClient } from '@/lib/server/supabase-admin';
import { verifyTrackingSignature } from '@/lib/server/tracking-link';
import {
  hidesPhotosOnPublicPage,
  jobRef,
  selectTrackingProof,
  trackingHeadline,
  trackingSteps,
  type TrackingProofRow,
} from '@/lib/client-alerts';
import { cleanCity } from '@/lib/sms';
import { isProofPathForDelivery } from '@/lib/proof-flow';
import { isSafeSignatureData } from '@/lib/customer-delivery';
import { AutoRefresh } from '@/components/delivery/AutoRefresh';

// Signed per-job tracking page sent to clients in delivery texts and emails.
// No sign-in: the link's signature is the key. Shows cities, never street
// addresses or names, and no photos on medical or HIPAA jobs.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Delivery tracking',
  robots: { index: false, follow: false },
};

const SIGNED_URL_SECONDS = 600;

async function signPaths(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  deliveryId: string,
  paths: string[]
): Promise<string[]> {
  const urls: string[] = [];
  for (const path of paths) {
    if (!isProofPathForDelivery(deliveryId, path)) continue;
    const { data } = await admin.storage.from('delivery-photos').createSignedUrl(path, SIGNED_URL_SECONDS);
    if (data?.signedUrl) urls.push(data.signedUrl);
  }
  return urls;
}

export default async function TrackDeliveryPage({
  params,
}: {
  params: Promise<{ id: string; sig: string }>;
}) {
  const { id, sig } = await params;
  if (!verifyTrackingSignature(id, sig)) notFound();

  const admin = createAdminClient();
  if (!admin) notFound();

  const { data: delivery } = await admin
    .from('deliveries')
    .select(
      'id, status, tracking_number, pickup_city, delivery_city, booked_at, assigned_at, actual_pickup_time, actual_delivery_time, is_medical, is_hipaa'
    )
    .eq('id', id.toLowerCase())
    .maybeSingle();
  if (!delivery) notFound();

  const { data: rows } = await admin
    .from('proof_of_delivery')
    .select('type, stage, photo_kind, photo_url, signature_data, recipient_name')
    .eq('delivery_id', delivery.id)
    .order('captured_at', { ascending: true });

  const hidePhotos = hidesPhotosOnPublicPage(delivery);
  const proof = selectTrackingProof((rows ?? []) as TrackingProofRow[], hidePhotos);
  const [pickupPhotos, dropoffPhotos] = await Promise.all([
    signPaths(admin, delivery.id, proof.pickupPhotoPaths),
    signPaths(admin, delivery.id, proof.dropoffPhotoPaths),
  ]);
  const signature = isSafeSignatureData(proof.signatureData) ? proof.signatureData : null;
  const steps = trackingSteps(delivery);
  const ref = jobRef(delivery.tracking_number, delivery.id);

  return (
    <section className="bg-gray-50 py-12 lg:py-16">
      {!['delivered', 'cancelled', 'failed'].includes(delivery.status) && <AutoRefresh seconds={30} />}
      <div className="max-w-2xl mx-auto px-4 space-y-6">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-6 w-6 text-epyc-primary" />
            <p className="text-sm text-gray-500">Delivery {ref}</p>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{trackingHeadline(delivery.status)}</h1>
          <p className="mt-1 text-gray-600">
            {cleanCity(delivery.pickup_city, 'Pickup')} to {cleanCity(delivery.delivery_city, 'drop-off')}
          </p>

          <ol className="mt-6 space-y-4">
            {steps.map((step) => (
              <li key={step.label} className="flex items-start gap-3">
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 text-epyc-primary mt-0.5" />
                ) : (
                  <Circle className="h-5 w-5 text-gray-300 mt-0.5" />
                )}
                <div>
                  <p className={step.done ? 'font-medium text-gray-900' : 'text-gray-400'}>{step.label}</p>
                  {step.done && step.at && <p className="text-sm text-gray-500">{step.at}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {pickupPhotos.length > 0 && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Pickup photos</h2>
            <div className="grid grid-cols-2 gap-3">
              {pickupPhotos.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt={`Pickup photo ${i + 1}`} className="w-full rounded-lg object-cover aspect-square" />
              ))}
            </div>
          </div>
        )}

        {(dropoffPhotos.length > 0 || signature || proof.receivedBy) && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Proof of delivery</h2>
            {proof.receivedBy && <p className="text-gray-700 mb-3">Received by {proof.receivedBy}</p>}
            {dropoffPhotos.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                {dropoffPhotos.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt={`Drop-off photo ${i + 1}`} className="w-full rounded-lg object-cover aspect-square" />
                ))}
              </div>
            )}
            {signature && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signature} alt="Signature" className="max-h-28 border border-gray-200 rounded bg-white" />
            )}
          </div>
        )}

        {hidePhotos && (
          <p className="text-sm text-gray-500">
            Photos for medical deliveries are only shown in your Epyc client account.
          </p>
        )}

        <p className="text-sm text-gray-500 flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Questions? Call or text (818) 217-0070. This page updates on its own.
        </p>
      </div>
    </section>
  );
}
