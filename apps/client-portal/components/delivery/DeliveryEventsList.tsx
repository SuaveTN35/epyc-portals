'use client';

import {
  Clock,
  Truck,
  Package,
  MapPin,
  CheckCircle,
  XCircle,
  User,
  AlertCircle,
  FileText,
} from 'lucide-react';
import type { DeliveryStatus } from '@epyc/shared';
import { DELIVERY_STATUS_CONFIG } from '@epyc/shared';

interface DeliveryEvent {
  id: string;
  delivery_id: string;
  event_type: string;
  status?: DeliveryStatus | null;
  description: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  created_by?: string | null;
}

interface DeliveryEventsListProps {
  events: DeliveryEvent[];
}

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  status_change: Clock,
  driver_assigned: User,
  pickup_completed: Package,
  delivery_completed: CheckCircle,
  delivery_failed: XCircle,
  delivery_cancelled: XCircle,
  location_update: MapPin,
  note_added: FileText,
  default: AlertCircle,
};

const EVENT_COLORS: Record<string, string> = {
  status_change: 'bg-blue-100 text-blue-600',
  driver_assigned: 'bg-purple-100 text-purple-600',
  pickup_completed: 'bg-amber-100 text-amber-600',
  delivery_completed: 'bg-green-100 text-green-600',
  delivery_failed: 'bg-red-100 text-red-600',
  delivery_cancelled: 'bg-gray-100 text-gray-600',
  location_update: 'bg-cyan-100 text-cyan-600',
  note_added: 'bg-yellow-100 text-yellow-600',
  default: 'bg-gray-100 text-gray-600',
};

export function DeliveryEventsList({ events }: DeliveryEventsListProps) {
  if (events.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Log</h3>
        <div className="text-center py-8 text-gray-500">
          No activity recorded yet
        </div>
      </div>
    );
  }

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Show relative time for recent events
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    // Show absolute time for older events
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: DeliveryStatus) => {
    const config = DELIVERY_STATUS_CONFIG[status];
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.color}`}
      >
        {config.label}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Log</h3>

      <div className="flow-root">
        <ul className="-mb-8">
          {events.map((event, eventIdx) => {
            const Icon = EVENT_ICONS[event.event_type] || EVENT_ICONS.default;
            const colorClass = EVENT_COLORS[event.event_type] || EVENT_COLORS.default;
            const isLast = eventIdx === events.length - 1;

            return (
              <li key={event.id}>
                <div className="relative pb-8">
                  {!isLast && (
                    <span
                      className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                      aria-hidden="true"
                    />
                  )}
                  <div className="relative flex space-x-3">
                    <div>
                      <span
                        className={`h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-white ${colorClass}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1">
                      <div>
                        <p className="text-sm text-gray-900">{event.description}</p>
                        {event.status && (
                          <div className="mt-1">{getStatusBadge(event.status)}</div>
                        )}
                        {event.created_by && (
                          <p className="mt-1 text-xs text-gray-500">
                            by {event.created_by}
                          </p>
                        )}
                      </div>
                      <div className="whitespace-nowrap text-right text-xs text-gray-500">
                        {formatTimestamp(event.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
