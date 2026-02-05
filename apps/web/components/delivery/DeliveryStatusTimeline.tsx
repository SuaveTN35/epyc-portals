'use client';

import { CheckCircle, Circle, Truck, Package, MapPin, Clock } from 'lucide-react';
import type { DeliveryStatus } from '@epyc/shared';
import { DELIVERY_STATUS_CONFIG } from '@epyc/shared';

interface TimelineStep {
  status: DeliveryStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TIMELINE_STEPS: TimelineStep[] = [
  { status: 'booked', label: 'Booked', icon: Package },
  { status: 'assigned', label: 'Driver Assigned', icon: Truck },
  { status: 'en_route_pickup', label: 'En Route to Pickup', icon: Truck },
  { status: 'picked_up', label: 'Picked Up', icon: Package },
  { status: 'en_route_delivery', label: 'En Route to Delivery', icon: Truck },
  { status: 'delivered', label: 'Delivered', icon: CheckCircle },
];

// Status progression order for comparison
const STATUS_ORDER: DeliveryStatus[] = [
  'quote_requested',
  'quoted',
  'booked',
  'assigned',
  'en_route_pickup',
  'arrived_pickup',
  'picked_up',
  'en_route_delivery',
  'arrived_delivery',
  'delivered',
];

interface DeliveryStatusTimelineProps {
  currentStatus: DeliveryStatus;
  timestamps?: {
    booked_at?: string | null;
    assigned_at?: string | null;
    pickup_started_at?: string | null;
    picked_up_at?: string | null;
    delivery_started_at?: string | null;
    delivered_at?: string | null;
  };
}

export function DeliveryStatusTimeline({
  currentStatus,
  timestamps = {},
}: DeliveryStatusTimelineProps) {
  const isCancelled = currentStatus === 'cancelled';
  const isFailed = currentStatus === 'failed';
  const isTerminal = isCancelled || isFailed;

  const currentStatusIndex = STATUS_ORDER.indexOf(currentStatus);

  const getStepState = (stepStatus: DeliveryStatus): 'completed' | 'current' | 'upcoming' => {
    if (isTerminal) {
      // Show steps up to where it was cancelled/failed
      const stepIndex = STATUS_ORDER.indexOf(stepStatus);
      if (stepIndex < currentStatusIndex) return 'completed';
      if (stepIndex === currentStatusIndex) return 'current';
      return 'upcoming';
    }

    const stepIndex = STATUS_ORDER.indexOf(stepStatus);
    if (stepIndex < currentStatusIndex) return 'completed';
    if (stepIndex === currentStatusIndex) return 'current';
    return 'upcoming';
  };

  const getTimestamp = (status: DeliveryStatus): string | null => {
    switch (status) {
      case 'booked':
        return timestamps.booked_at || null;
      case 'assigned':
        return timestamps.assigned_at || null;
      case 'en_route_pickup':
        return timestamps.pickup_started_at || null;
      case 'picked_up':
        return timestamps.picked_up_at || null;
      case 'en_route_delivery':
        return timestamps.delivery_started_at || null;
      case 'delivered':
        return timestamps.delivered_at || null;
      default:
        return null;
    }
  };

  const formatTimestamp = (timestamp: string | null): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Delivery Status</h3>

      {/* Terminal Status Alert */}
      {isTerminal && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            isCancelled ? 'bg-gray-100 text-gray-700' : 'bg-red-50 text-red-700'
          }`}
        >
          <p className="font-medium">
            {isCancelled ? 'This delivery was cancelled' : 'This delivery failed'}
          </p>
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {TIMELINE_STEPS.map((step, index) => {
          const state = getStepState(step.status);
          const timestamp = getTimestamp(step.status);
          const Icon = step.icon;
          const isLast = index === TIMELINE_STEPS.length - 1;

          return (
            <div key={step.status} className="relative pb-8 last:pb-0">
              {/* Connector Line */}
              {!isLast && (
                <div
                  className={`absolute left-4 top-8 w-0.5 h-full -ml-px ${
                    state === 'completed' ? 'bg-epyc-primary' : 'bg-gray-200'
                  }`}
                />
              )}

              <div className="relative flex items-start">
                {/* Icon */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    state === 'completed'
                      ? 'bg-epyc-primary text-white'
                      : state === 'current'
                      ? 'bg-epyc-accent text-white ring-4 ring-emerald-100'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {state === 'completed' ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : state === 'current' ? (
                    <Icon className="h-4 w-4" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </div>

                {/* Content */}
                <div className="ml-4 min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      state === 'upcoming' ? 'text-gray-400' : 'text-gray-900'
                    }`}
                  >
                    {step.label}
                  </p>
                  {timestamp && state !== 'upcoming' && (
                    <p className="mt-0.5 text-xs text-gray-500 flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatTimestamp(timestamp)}
                    </p>
                  )}
                  {state === 'current' && !isTerminal && (
                    <p className="mt-1 text-xs text-epyc-accent font-medium">In Progress</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
