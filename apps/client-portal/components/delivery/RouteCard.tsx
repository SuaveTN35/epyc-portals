'use client';

import { MapPin, Phone, FileText, Navigation } from 'lucide-react';

interface LocationInfo {
  type: 'pickup' | 'delivery';
  address: string;
  city: string;
  state: string;
  zip: string;
  contactName?: string | null;
  contactPhone?: string | null;
  instructions?: string | null;
}

interface RouteCardProps {
  pickup: LocationInfo;
  delivery: LocationInfo;
  distanceMiles?: number | null;
  estimatedMinutes?: number | null;
}

function LocationSection({ location }: { location: LocationInfo }) {
  const isPickup = location.type === 'pickup';

  return (
    <div className="flex-1">
      <div className="flex items-center mb-3">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isPickup ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
          }`}
        >
          <MapPin className="h-4 w-4" />
        </div>
        <span
          className={`ml-2 text-sm font-medium ${
            isPickup ? 'text-blue-600' : 'text-green-600'
          }`}
        >
          {isPickup ? 'Pickup' : 'Delivery'}
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-gray-900 font-medium">{location.address}</p>
        <p className="text-sm text-gray-600">
          {location.city}, {location.state} {location.zip}
        </p>

        {location.contactName && (
          <div className="flex items-center text-sm text-gray-600 pt-2">
            <span className="font-medium">{location.contactName}</span>
          </div>
        )}

        {location.contactPhone && (
          <a
            href={`tel:${location.contactPhone}`}
            className="flex items-center text-sm text-epyc-primary hover:underline"
          >
            <Phone className="h-3 w-3 mr-1" />
            {location.contactPhone}
          </a>
        )}

        {location.instructions && (
          <div className="flex items-start text-sm text-gray-500 pt-2 border-t border-gray-100 mt-2">
            <FileText className="h-4 w-4 mr-1 flex-shrink-0 mt-0.5" />
            <span>{location.instructions}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function RouteCard({
  pickup,
  delivery,
  distanceMiles,
  estimatedMinutes,
}: RouteCardProps) {
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Route</h3>
        {(distanceMiles || estimatedMinutes) && (
          <div className="flex items-center text-sm text-gray-500">
            <Navigation className="h-4 w-4 mr-1" />
            {distanceMiles && <span>{distanceMiles.toFixed(1)} mi</span>}
            {distanceMiles && estimatedMinutes && <span className="mx-1">•</span>}
            {estimatedMinutes && <span>{formatDuration(estimatedMinutes)}</span>}
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <LocationSection location={{ ...pickup, type: 'pickup' }} />

        {/* Connector */}
        <div className="hidden md:flex flex-col items-center justify-center px-4">
          <div className="w-0.5 h-4 bg-gray-200" />
          <div className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center">
            <span className="text-xs text-gray-400">→</span>
          </div>
          <div className="w-0.5 h-4 bg-gray-200" />
        </div>

        {/* Mobile connector */}
        <div className="md:hidden flex items-center justify-center">
          <div className="w-0.5 h-8 bg-gray-200" />
        </div>

        <LocationSection location={{ ...delivery, type: 'delivery' }} />
      </div>
    </div>
  );
}
