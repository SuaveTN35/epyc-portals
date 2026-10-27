'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Package,
  Clock,
  Navigation,
  Thermometer,
  ChevronRight,
  RefreshCw,
  Loader2,
  Power,
  Pencil,
  AlertTriangle,
} from 'lucide-react';
import { VEHICLE_CONFIG, formatCurrency, formatDistance, formatDuration } from '@epyc/shared';
import type { VehicleType } from '@epyc/shared';
import { formatWindow, type DriverOfferPayload } from '@/lib/job-offers';
import { InstallAppCard } from '@/components/driver/InstallAppCard';

export default function JobsPage() {
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobOffers, setJobOffers] = useState<DriverOfferPayload[]>([]);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Offers come from the server: RLS hides an unassigned delivery from the
  // driver, so the browser cannot read the job details itself.
  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: driver } = await supabase
      .from('drivers')
      .select('is_online')
      .eq('profile_id', user.id)
      .single();
    if (driver) setIsOnline(!!driver.is_online);

    try {
      const res = await fetch('/api/driver/offers', { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'Could not load job offers.');
      } else {
        setJobOffers(body.offers || []);
      }
    } catch {
      setError('Could not load job offers. Check your signal.');
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchData();

    // New offers for this driver arrive as job_offers inserts.
    const channel = supabase
      .channel('job-offers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_offers' }, () => {
        fetchData();
      })
      .subscribe();

    // Poll for offers every 30 seconds (offers only; no location is sent).
    const interval = setInterval(fetchData, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchData]);

  const toggleOnlineStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newStatus = !isOnline;
    setError(null);

    // Availability only. Location is NOT captured when going online: under the
    // driver agreement, location is collected only during an active job. If
    // matching ever needs it, it will be added behind an explicit opt-in.
    const { error: updateError } = await supabase
      .from('drivers')
      .update({ is_online: newStatus, last_active_at: new Date().toISOString() })
      .eq('profile_id', user.id);

    if (updateError) {
      setError(`Could not change your status: ${updateError.message}`);
      return;
    }
    setIsOnline(newStatus);
  };

  const respond = async (offerId: string, action: 'accept' | 'decline') => {
    setRespondingTo(offerId);
    setError(null);
    try {
      const res = await fetch(`/api/driver/offers/${offerId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'Something went wrong. Try again.');
        // The offer may be gone (taken or expired); refresh the list.
        fetchData();
        return;
      }
      if (action === 'accept' && body.delivery_id) {
        window.location.href = `/driver/delivery/${body.delivery_id}`;
        return;
      }
      setJobOffers((prev) => prev.filter((j) => j.id !== offerId));
    } catch {
      setError('Could not reach the server. Check your signal and try again.');
    } finally {
      setRespondingTo(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-epyc-primary" />
      </div>
    );
  }

  return (
    <div>
      <InstallAppCard />

      {/* Online Toggle Card */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Driver Status</h2>
            <p className="text-sm text-gray-500">
              {isOnline ? 'You are receiving job offers' : 'Go online to receive jobs'}
            </p>
          </div>
          <button
            onClick={toggleOnlineStatus}
            className={`relative flex items-center px-4 py-2 rounded-full font-medium transition-colors ${
              isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Power className="h-5 w-5 mr-2" />
            {isOnline ? 'Online' : 'Offline'}
          </button>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Available Jobs</h1>
        <button
          onClick={() => {
            setRefreshing(true);
            fetchData();
          }}
          disabled={refreshing}
          className="flex items-center text-epyc-primary"
        >
          <RefreshCw className={`h-5 w-5 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start">
          <AlertTriangle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-sm text-red-700 underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Job Offers List */}
      {!isOnline ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <Power className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
          <h3 className="font-semibold text-yellow-800 mb-2">You&apos;re Offline</h3>
          <p className="text-yellow-700 text-sm">Go online to start receiving job offers.</p>
        </div>
      ) : jobOffers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-6 text-center">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700 mb-2">No Jobs Available</h3>
          <p className="text-gray-500 text-sm">
            Stay online - new jobs will appear here automatically. Declining a job never
            counts against you.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobOffers.map((offer) => (
            <JobCard
              key={offer.id}
              offer={offer}
              onAccept={() => respond(offer.id, 'accept')}
              onDecline={() => respond(offer.id, 'decline')}
              busy={respondingTo === offer.id}
              disabled={respondingTo !== null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function JobCard({
  offer,
  onAccept,
  onDecline,
  busy,
  disabled,
}: {
  offer: DriverOfferPayload;
  onAccept: () => void;
  onDecline: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  const now = useNow(1000);
  const vehicleConfig =
    VEHICLE_CONFIG[(offer.vehicle_required as VehicleType) || 'car'] ?? VEHICLE_CONFIG.car;

  const expiresAt = new Date(offer.expires_at).getTime();
  const createdAt = new Date(offer.created_at).getTime();
  const total = Math.max(1, expiresAt - createdAt);
  const remainingMs = Math.max(0, expiresAt - now);
  const pct = Math.min(100, (remainingMs / total) * 100);
  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000);
  const expired = remainingMs === 0;

  const pickupWindow = formatWindow(offer.pickup_window_start, offer.pickup_window_end);
  const deliveryWindow = formatWindow(offer.delivery_window_start, offer.delivery_window_end);

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Timer Bar */}
      <div className="h-1 bg-gray-200">
        <div className="h-full bg-epyc-primary transition-all duration-1000" style={{ width: `${pct}%` }} />
      </div>

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="font-medium text-gray-900">{vehicleConfig.label}</span>
            {offer.service_level && (
              <span className="text-xs text-gray-500 capitalize">{offer.service_level}</span>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-epyc-primary">
              {offer.estimated_payout != null ? formatCurrency(offer.estimated_payout) : '-'}
            </p>
            <p className="text-xs text-gray-500">
              {expired ? 'Expired' : `${mins}:${secs.toString().padStart(2, '0')} to accept`}
            </p>
          </div>
        </div>

        {/* Route Info: city level only until accepted */}
        <div className="space-y-2 mb-4">
          <div className="flex items-start">
            <div className="w-6 flex justify-center">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                Pickup: {offer.pickup_city}, {offer.pickup_state}
              </p>
              {pickupWindow && <p className="text-xs text-gray-500">{pickupWindow}</p>}
            </div>
          </div>
          {offer.distance_to_pickup_miles != null && (
            <div className="flex items-start">
              <div className="w-6 flex justify-center">
                <div className="h-6 border-l-2 border-dashed border-gray-300" />
              </div>
              <p className="text-xs text-gray-400">
                {formatDistance(offer.distance_to_pickup_miles)} to pickup
              </p>
            </div>
          )}
          <div className="flex items-start">
            <div className="w-6 flex justify-center">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                Drop-off: {offer.delivery_city}, {offer.delivery_state}
              </p>
              {deliveryWindow && <p className="text-xs text-gray-500">{deliveryWindow}</p>}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="flex flex-wrap gap-2 mb-4">
          {offer.trip_miles != null && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
              <Navigation className="h-3 w-3 mr-1" />
              {formatDistance(offer.trip_miles)}
            </span>
          )}
          {offer.estimated_minutes != null && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
              <Clock className="h-3 w-3 mr-1" />
              {formatDuration(offer.estimated_minutes)}
            </span>
          )}
          {offer.requires_signature && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700">
              <Pencil className="h-3 w-3 mr-1" />
              Signature
            </span>
          )}
          {offer.requires_temperature_control && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-cyan-100 text-cyan-700">
              <Thermometer className="h-3 w-3 mr-1" />
              Temp Control
            </span>
          )}
        </div>

        {offer.package_summary && (
          <p className="text-sm text-gray-600 mb-4 bg-gray-50 rounded-lg p-2">
            <Package className="h-4 w-4 inline mr-1 text-gray-400" />
            {offer.package_summary}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={onDecline}
            disabled={disabled}
            className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 touch-target"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            disabled={disabled || expired}
            className="flex-1 py-3 px-4 bg-epyc-primary text-white rounded-lg font-medium hover:bg-epyc-secondary disabled:opacity-50 flex items-center justify-center touch-target"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Accept
                <ChevronRight className="h-5 w-5 ml-1" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
