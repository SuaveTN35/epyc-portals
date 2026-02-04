'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  MapPin,
  Package,
  Clock,
  DollarSign,
  Navigation,
  Thermometer,
  Shield,
  ChevronRight,
  RefreshCw,
  Loader2,
  Power,
} from 'lucide-react';
import { VEHICLE_CONFIG, formatCurrency, formatDistance, formatDuration } from '@epyc/shared';
import type { JobOffer, Delivery } from '@epyc/shared';

interface JobOfferWithDelivery extends JobOffer {
  delivery: Delivery;
}

export default function JobsPage() {
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobOffers, setJobOffers] = useState<JobOfferWithDelivery[]>([]);
  const [acceptingJob, setAcceptingJob] = useState<string | null>(null);

  const supabase = createClient();

  // Fetch driver status and job offers
  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get driver record
    const { data: driver } = await supabase
      .from('drivers')
      .select('id, is_online, current_lat, current_lng')
      .eq('profile_id', user.id)
      .single();

    if (driver) {
      setIsOnline(driver.is_online);

      // Fetch pending job offers
      const { data: offers } = await supabase
        .from('job_offers')
        .select(`
          *,
          delivery:deliveries(*)
        `)
        .eq('driver_id', driver.id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      setJobOffers((offers as JobOfferWithDelivery[]) || []);
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();

    // Subscribe to real-time job offers
    const channel = supabase
      .channel('job-offers')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_offers',
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const toggleOnlineStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newStatus = !isOnline;

    // Update driver status
    await supabase
      .from('drivers')
      .update({ is_online: newStatus })
      .eq('profile_id', user.id);

    setIsOnline(newStatus);

    // If going online, try to get current location
    if (newStatus && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          await supabase
            .from('drivers')
            .update({
              current_lat: position.coords.latitude,
              current_lng: position.coords.longitude,
            })
            .eq('profile_id', user.id);
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  };

  const acceptJob = async (offerId: string, deliveryId: string) => {
    setAcceptingJob(offerId);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get driver ID
    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('profile_id', user.id)
      .single();

    if (!driver) return;

    // Accept the offer
    const { error: offerError } = await supabase
      .from('job_offers')
      .update({
        status: 'accepted',
        responded_at: new Date().toISOString(),
      })
      .eq('id', offerId);

    if (offerError) {
      console.error('Error accepting offer:', offerError);
      setAcceptingJob(null);
      return;
    }

    // Update delivery status
    await supabase
      .from('deliveries')
      .update({
        driver_id: driver.id,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
      })
      .eq('id', deliveryId);

    // Redirect to active delivery
    window.location.href = `/delivery/${deliveryId}`;
  };

  const rejectJob = async (offerId: string) => {
    await supabase
      .from('job_offers')
      .update({
        status: 'rejected',
        responded_at: new Date().toISOString(),
      })
      .eq('id', offerId);

    // Remove from list
    setJobOffers((prev) => prev.filter((j) => j.id !== offerId));
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
              isOnline
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
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

      {/* Job Offers List */}
      {!isOnline ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <Power className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
          <h3 className="font-semibold text-yellow-800 mb-2">You&apos;re Offline</h3>
          <p className="text-yellow-700 text-sm">
            Go online to start receiving job offers in your area.
          </p>
        </div>
      ) : jobOffers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-6 text-center">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700 mb-2">No Jobs Available</h3>
          <p className="text-gray-500 text-sm">
            Stay online - new jobs will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobOffers.map((offer) => (
            <JobCard
              key={offer.id}
              offer={offer}
              onAccept={() => acceptJob(offer.id, offer.delivery_id)}
              onReject={() => rejectJob(offer.id)}
              accepting={acceptingJob === offer.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({
  offer,
  onAccept,
  onReject,
  accepting,
}: {
  offer: JobOfferWithDelivery;
  onAccept: () => void;
  onReject: () => void;
  accepting: boolean;
}) {
  const delivery = offer.delivery;
  const vehicleConfig = VEHICLE_CONFIG[delivery.vehicle_required || 'car'];

  // Calculate time remaining
  const expiresAt = new Date(offer.expires_at);
  const now = new Date();
  const secondsRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Timer Bar */}
      <div className="h-1 bg-gray-200">
        <div
          className="h-full bg-epyc-primary transition-all duration-1000"
          style={{ width: `${(secondsRemaining / 60) * 100}%` }}
        />
      </div>

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">{vehicleConfig.icon}</span>
            <span className="font-medium text-gray-900">{vehicleConfig.label}</span>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-epyc-primary">
              {formatCurrency(offer.estimated_payout)}
            </p>
            <p className="text-xs text-gray-500">{secondsRemaining}s to accept</p>
          </div>
        </div>

        {/* Route Info */}
        <div className="space-y-2 mb-4">
          <div className="flex items-start">
            <div className="w-6 flex justify-center">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {delivery.pickup_address}
              </p>
              <p className="text-xs text-gray-500">
                {delivery.pickup_city}, {delivery.pickup_state}
              </p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="w-6 flex justify-center">
              <div className="h-6 border-l-2 border-dashed border-gray-300" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-400">
                {formatDistance(offer.distance_to_pickup_miles)} to pickup
              </p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="w-6 flex justify-center">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {delivery.delivery_address}
              </p>
              <p className="text-xs text-gray-500">
                {delivery.delivery_city}, {delivery.delivery_state}
              </p>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
            <Navigation className="h-3 w-3 mr-1" />
            {formatDistance(delivery.distance_miles || 0)}
          </span>
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
            <Clock className="h-3 w-3 mr-1" />
            {formatDuration(delivery.estimated_duration_minutes || 0)}
          </span>
          {delivery.package_weight && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
              <Package className="h-3 w-3 mr-1" />
              {delivery.package_weight} lbs
            </span>
          )}
          {delivery.is_hipaa && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
              <Shield className="h-3 w-3 mr-1" />
              HIPAA
            </span>
          )}
          {delivery.requires_temperature_control && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-cyan-100 text-cyan-700">
              <Thermometer className="h-3 w-3 mr-1" />
              Temp Control
            </span>
          )}
        </div>

        {/* Package Description */}
        {delivery.package_description && (
          <p className="text-sm text-gray-600 mb-4 bg-gray-50 rounded-lg p-2">
            {delivery.package_description}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={onReject}
            disabled={accepting}
            className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 touch-target"
          >
            Reject
          </button>
          <button
            onClick={onAccept}
            disabled={accepting}
            className="flex-1 py-3 px-4 bg-epyc-primary text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center touch-target"
          >
            {accepting ? (
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
