'use client';

import { User, Phone, Car, Star } from 'lucide-react';
import { VEHICLE_CONFIG } from '@epyc/shared';
import type { VehicleType } from '@epyc/shared';

interface DriverInfo {
  id: string;
  full_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  vehicle_type?: VehicleType | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_color?: string | null;
  license_plate?: string | null;
  rating?: number | null;
  total_deliveries?: number | null;
}

interface DriverCardProps {
  driver: DriverInfo | null;
  status?: string;
}

export function DriverCard({ driver, status }: DriverCardProps) {
  if (!driver) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Driver</h3>
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <User className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-gray-500">
            {status === 'booked'
              ? 'A driver will be assigned shortly'
              : 'No driver assigned'}
          </p>
        </div>
      </div>
    );
  }

  const vehicleConfig = driver.vehicle_type ? VEHICLE_CONFIG[driver.vehicle_type] : null;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Driver</h3>

      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {driver.avatar_url ? (
            <img
              src={driver.avatar_url}
              alt={driver.full_name}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-epyc-primary/10 flex items-center justify-center">
              <span className="text-2xl font-semibold text-epyc-primary">
                {driver.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h4 className="text-lg font-medium text-gray-900">{driver.full_name}</h4>

          {/* Rating */}
          {driver.rating && (
            <div className="flex items-center mt-1">
              <Star className="h-4 w-4 text-yellow-400 fill-current" />
              <span className="ml-1 text-sm text-gray-600">
                {driver.rating.toFixed(1)}
              </span>
              {driver.total_deliveries && (
                <span className="ml-2 text-sm text-gray-400">
                  ({driver.total_deliveries} deliveries)
                </span>
              )}
            </div>
          )}

          {/* Phone */}
          {driver.phone && (
            <a
              href={`tel:${driver.phone}`}
              className="flex items-center mt-2 text-sm text-epyc-primary hover:underline"
            >
              <Phone className="h-4 w-4 mr-1" />
              {driver.phone}
            </a>
          )}
        </div>
      </div>

      {/* Vehicle Info */}
      {(vehicleConfig || driver.vehicle_make || driver.license_plate) && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center text-sm text-gray-600">
            <Car className="h-4 w-4 mr-2 text-gray-400" />
            <span>
              {vehicleConfig && <span className="mr-1">{vehicleConfig.icon}</span>}
              {driver.vehicle_color && (
                <span className="capitalize">{driver.vehicle_color} </span>
              )}
              {driver.vehicle_make} {driver.vehicle_model}
            </span>
          </div>
          {driver.license_plate && (
            <div className="mt-1 ml-6 text-sm text-gray-500">
              Plate: <span className="font-mono">{driver.license_plate}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
