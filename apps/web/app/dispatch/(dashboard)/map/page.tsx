'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useGoogleMaps } from '@/lib/hooks/useGoogleMaps';
import {
  Map,
  Truck,
  Package,
  User,
  MapPin,
  Clock,
  RefreshCw,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Phone,
  Navigation,
} from 'lucide-react';

interface DriverLocation {
  id: string;
  driver_id: string;
  full_name: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  vehicle_type: string;
  current_delivery_id: string | null;
  current_delivery_tracking: string | null;
  updated_at: string;
}

interface ActiveDelivery {
  id: string;
  tracking_number: string;
  status: string;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  delivery_address: string;
  delivery_lat: number;
  delivery_lng: number;
  driver_name: string | null;
  service_level: string;
}

const statusColors: Record<string, string> = {
  pending: '#EAB308',
  assigned: '#3B82F6',
  picked_up: '#8B5CF6',
  in_transit: '#6366F1',
};

export default function LiveMapPage() {
  const [loading, setLoading] = useState(true);
  const [driverLocations, setDriverLocations] = useState<DriverLocation[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<ActiveDelivery[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<DriverLocation | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<ActiveDelivery | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filter, setFilter] = useState<'all' | 'drivers' | 'deliveries'>('all');
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  const { isLoaded, loadError, google } = useGoogleMaps({ libraries: ['places'] });

  useEffect(() => {
    fetchMapData();

    const supabase = createClient();

    // Subscribe to driver location updates
    const locationSubscription = supabase
      .channel('driver-locations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_locations' },
        () => fetchMapData()
      )
      .subscribe();

    // Subscribe to delivery updates
    const deliverySubscription = supabase
      .channel('active-deliveries')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deliveries' },
        () => fetchMapData()
      )
      .subscribe();

    // Refresh every 10 seconds
    const interval = setInterval(fetchMapData, 10000);

    return () => {
      supabase.removeChannel(locationSubscription);
      supabase.removeChannel(deliverySubscription);
      clearInterval(interval);
    };
  }, []);

  // Initialize Google Map
  useEffect(() => {
    if (!isLoaded || !google || !mapRef.current || googleMapRef.current) return;

    googleMapRef.current = new google.maps.Map(mapRef.current, {
      center: { lat: 34.0522, lng: -118.2437 }, // Default to LA
      zoom: 11,
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      ],
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
  }, [isLoaded, google]);

  // Update markers when data changes
  const updateMarkers = useCallback(() => {
    if (!google || !googleMapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    // Add driver markers
    driverLocations.forEach((driver) => {
      const position = { lat: driver.latitude, lng: driver.longitude };
      bounds.extend(position);
      hasPoints = true;

      const marker = new google.maps.Marker({
        position,
        map: googleMapRef.current!,
        title: driver.full_name,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: driver.current_delivery_id ? '#3B82F6' : '#22C55E',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          rotation: driver.heading || 0,
        },
      });

      marker.addListener('click', () => {
        setSelectedDriver(driver);
        setSelectedDelivery(null);
      });

      markersRef.current.push(marker);
    });

    // Add delivery markers (pickup = green, delivery = red)
    activeDeliveries.forEach((delivery) => {
      if (delivery.pickup_lat && delivery.pickup_lng) {
        const pickupPos = { lat: delivery.pickup_lat, lng: delivery.pickup_lng };
        bounds.extend(pickupPos);
        hasPoints = true;

        const pickupMarker = new google.maps.Marker({
          position: pickupPos,
          map: googleMapRef.current!,
          title: `Pickup: ${delivery.tracking_number}`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#22C55E',
            fillOpacity: 0.8,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });

        pickupMarker.addListener('click', () => {
          setSelectedDelivery(delivery);
          setSelectedDriver(null);
        });

        markersRef.current.push(pickupMarker);
      }

      if (delivery.delivery_lat && delivery.delivery_lng) {
        const deliveryPos = { lat: delivery.delivery_lat, lng: delivery.delivery_lng };
        bounds.extend(deliveryPos);
        hasPoints = true;

        const deliveryMarker = new google.maps.Marker({
          position: deliveryPos,
          map: googleMapRef.current!,
          title: `Delivery: ${delivery.tracking_number}`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#EF4444',
            fillOpacity: 0.8,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });

        deliveryMarker.addListener('click', () => {
          setSelectedDelivery(delivery);
          setSelectedDriver(null);
        });

        markersRef.current.push(deliveryMarker);
      }
    });

    // Fit bounds if we have points
    if (hasPoints && googleMapRef.current) {
      googleMapRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      // Don't zoom in too far
      const listener = google.maps.event.addListener(googleMapRef.current, 'idle', () => {
        if (googleMapRef.current!.getZoom()! > 15) {
          googleMapRef.current!.setZoom(15);
        }
        google.maps.event.removeListener(listener);
      });
    }
  }, [google, driverLocations, activeDeliveries]);

  useEffect(() => {
    updateMarkers();
  }, [updateMarkers]);

  const fetchMapData = async () => {
    const supabase = createClient();

    // Fetch driver locations with driver info
    const { data: locations } = await supabase
      .from('driver_locations')
      .select(`
        *,
        driver:drivers(
          id,
          vehicle_type,
          profiles:profile_id(full_name)
        )
      `)
      .gte('recorded_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (locations) {
      setDriverLocations(
        locations.map((loc: any) => ({
          id: loc.id,
          driver_id: loc.driver_id,
          full_name: loc.driver?.profiles?.full_name || 'Unknown',
          latitude: loc.lat,
          longitude: loc.lng,
          heading: loc.heading,
          speed: loc.speed,
          vehicle_type: loc.driver?.vehicle_type || 'car',
          current_delivery_id: null,
          current_delivery_tracking: null,
          updated_at: loc.recorded_at,
        }))
      );
    }

    // Fetch active deliveries
    const { data: deliveries } = await supabase
      .from('deliveries')
      .select(`
        id,
        tracking_number,
        status,
        pickup_address,
        pickup_lat,
        pickup_lng,
        delivery_address,
        delivery_lat,
        delivery_lng,
        service_level,
        driver_id
      `)
      .in('status', ['pending', 'assigned', 'picked_up', 'in_transit']);

    if (deliveries) {
      setActiveDeliveries(
        deliveries.map((d: any) => ({
          id: d.id,
          tracking_number: d.tracking_number,
          status: d.status,
          pickup_address: d.pickup_address,
          pickup_lat: d.pickup_lat,
          pickup_lng: d.pickup_lng,
          delivery_address: d.delivery_address,
          delivery_lat: d.delivery_lat,
          delivery_lng: d.delivery_lng,
          driver_name: null,
          service_level: d.service_level,
        }))
      );
    }

    setLoading(false);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex">
      {/* Sidebar */}
      <div
        className={`bg-white border-r border-gray-200 transition-all duration-300 ${
          sidebarOpen ? 'w-80' : 'w-0'
        } overflow-hidden`}
      >
        <div className="h-full flex flex-col w-80">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Live Tracking</h2>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setFilter('all')}
                className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  filter === 'all'
                    ? 'bg-epyc-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('drivers')}
                className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  filter === 'drivers'
                    ? 'bg-epyc-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Drivers
              </button>
              <button
                onClick={() => setFilter('deliveries')}
                className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  filter === 'deliveries'
                    ? 'bg-epyc-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Deliveries
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Drivers section */}
            {(filter === 'all' || filter === 'drivers') && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-500">
                    Online Drivers ({driverLocations.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {driverLocations.map((driver) => (
                    <button
                      key={driver.id}
                      onClick={() => {
                        setSelectedDriver(driver);
                        setSelectedDelivery(null);
                        if (googleMapRef.current) {
                          googleMapRef.current.panTo({ lat: driver.latitude, lng: driver.longitude });
                          googleMapRef.current.setZoom(14);
                        }
                      }}
                      className={`w-full p-3 text-left rounded-lg border transition-colors ${
                        selectedDriver?.id === driver.id
                          ? 'border-epyc-primary bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                          <Truck className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {driver.full_name}
                          </p>
                          <p className="text-xs text-gray-500 capitalize">
                            {driver.vehicle_type.replace('_', ' ')}
                          </p>
                        </div>
                        {driver.current_delivery_id && (
                          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      {driver.current_delivery_tracking && (
                        <p className="mt-2 text-xs text-gray-600">
                          Delivering: {driver.current_delivery_tracking}
                        </p>
                      )}
                    </button>
                  ))}
                  {driverLocations.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No drivers online
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Deliveries section */}
            {(filter === 'all' || filter === 'deliveries') && (
              <div className="p-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-500">
                    Active Deliveries ({activeDeliveries.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {activeDeliveries.map((delivery) => (
                    <button
                      key={delivery.id}
                      onClick={() => {
                        setSelectedDelivery(delivery);
                        setSelectedDriver(null);
                        if (googleMapRef.current && delivery.pickup_lat && delivery.pickup_lng) {
                          googleMapRef.current.panTo({ lat: delivery.pickup_lat, lng: delivery.pickup_lng });
                          googleMapRef.current.setZoom(13);
                        }
                      }}
                      className={`w-full p-3 text-left rounded-lg border transition-colors ${
                        selectedDelivery?.id === delivery.id
                          ? 'border-epyc-primary bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-epyc-primary">
                          {delivery.tracking_number}
                        </span>
                        <span
                          className="px-2 py-0.5 text-xs rounded-full capitalize"
                          style={{
                            backgroundColor: `${statusColors[delivery.status]}20`,
                            color: statusColors[delivery.status],
                          }}
                        >
                          {delivery.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-start gap-2">
                          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center mt-0.5">
                            <span className="w-1.5 h-1.5 bg-white rounded-full" />
                          </div>
                          <p className="text-xs text-gray-600 flex-1 truncate">
                            {delivery.pickup_address.split(',')[0]}
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center mt-0.5">
                            <span className="w-1.5 h-1.5 bg-white rounded-full" />
                          </div>
                          <p className="text-xs text-gray-600 flex-1 truncate">
                            {delivery.delivery_address.split(',')[0]}
                          </p>
                        </div>
                      </div>
                      {delivery.driver_name ? (
                        <p className="mt-2 text-xs text-gray-500">
                          Driver: {delivery.driver_name}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-yellow-600">
                          Awaiting driver
                        </p>
                      )}
                    </button>
                  ))}
                  {activeDeliveries.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No active deliveries
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Map area */}
      <div className="flex-1 relative">
        {/* Toggle sidebar button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-4 left-4 z-10 p-2 bg-white rounded-lg shadow-md hover:bg-gray-50"
        >
          {sidebarOpen ? (
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-600" />
          )}
        </button>

        {/* Refresh button */}
        <button
          onClick={fetchMapData}
          className="absolute top-4 right-4 z-10 p-2 bg-white rounded-lg shadow-md hover:bg-gray-50"
        >
          <RefreshCw className="h-5 w-5 text-gray-600" />
        </button>

        {/* Google Map */}
        <div ref={mapRef} className="h-full map-container">
          {(!isLoaded || loading) && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <Loader2 className="h-8 w-8 animate-spin text-epyc-primary" />
            </div>
          )}
          {loadError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100">
              <Map className="h-16 w-16 text-gray-400 mb-4" />
              <p className="text-gray-500 text-center max-w-md px-4">
                Unable to load Google Maps. Please check your API key configuration.
              </p>
              <div className="mt-4 bg-white rounded-lg shadow-md p-4 max-w-sm">
                <p className="text-sm text-gray-600">
                  {driverLocations.length} drivers with GPS data
                </p>
                <p className="text-sm text-gray-600">
                  {activeDeliveries.length} active delivery routes
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Selected driver info panel */}
        {selectedDriver && (
          <div className="absolute bottom-4 left-4 right-4 max-w-md bg-white rounded-xl shadow-lg p-4 z-10">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <Truck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedDriver.full_name}</h3>
                  <p className="text-sm text-gray-500 capitalize">
                    {selectedDriver.vehicle_type.replace('_', ' ')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDriver(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500">Speed</p>
                <p className="font-medium">
                  {selectedDriver.speed ? `${Math.round(selectedDriver.speed)} mph` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Heading</p>
                <p className="font-medium">
                  {selectedDriver.heading ? `${Math.round(selectedDriver.heading)}°` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Updated</p>
                <p className="font-medium">
                  {new Date(selectedDriver.updated_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Link
                href={`/dispatch/drivers/${selectedDriver.driver_id}`}
                className="flex-1 px-4 py-2 text-sm text-center bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                View Profile
              </Link>
              {selectedDriver.current_delivery_id && (
                <Link
                  href={`/dispatch/deliveries/${selectedDriver.current_delivery_id}`}
                  className="flex-1 px-4 py-2 text-sm text-center bg-epyc-primary text-white rounded-lg hover:bg-blue-700"
                >
                  View Delivery
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Selected delivery info panel */}
        {selectedDelivery && (
          <div className="absolute bottom-4 left-4 right-4 max-w-md bg-white rounded-xl shadow-lg p-4 z-10">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-epyc-primary">
                  {selectedDelivery.tracking_number}
                </h3>
                <span
                  className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full capitalize"
                  style={{
                    backgroundColor: `${statusColors[selectedDelivery.status]}20`,
                    color: statusColors[selectedDelivery.status],
                  }}
                >
                  {selectedDelivery.status.replace('_', ' ')}
                </span>
              </div>
              <button
                onClick={() => setSelectedDelivery(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                  <MapPin className="h-3 w-3 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Pickup</p>
                  <p className="text-sm">{selectedDelivery.pickup_address}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                  <MapPin className="h-3 w-3 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Delivery</p>
                  <p className="text-sm">{selectedDelivery.delivery_address}</p>
                </div>
              </div>
            </div>
            {selectedDelivery.driver_name && (
              <p className="mt-3 text-sm text-gray-600">
                Driver: <span className="font-medium">{selectedDelivery.driver_name}</span>
              </p>
            )}
            <div className="mt-4">
              <Link
                href={`/dispatch/deliveries/${selectedDelivery.id}`}
                className="block w-full px-4 py-2 text-sm text-center bg-epyc-primary text-white rounded-lg hover:bg-blue-700"
              >
                View Details
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
