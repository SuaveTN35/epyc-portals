'use client';

import { MessageSquare, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface SupportTicket {
  id: string;
  subject: string;
  category: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
}

interface TicketListProps {
  tickets: SupportTicket[];
}

const STATUS_CONFIG = {
  open: {
    label: 'Open',
    icon: AlertCircle,
    color: 'text-yellow-600',
    bg: 'bg-yellow-100',
  },
  in_progress: {
    label: 'In Progress',
    icon: Clock,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
  },
  resolved: {
    label: 'Resolved',
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-100',
  },
  closed: {
    label: 'Closed',
    icon: CheckCircle,
    color: 'text-gray-600',
    bg: 'bg-gray-100',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  delivery_issue: 'Delivery Issue',
  billing: 'Billing',
  tracking: 'Tracking',
  damage_claim: 'Damage Claim',
  feedback: 'Feedback',
  other: 'Other',
};

export function TicketList({ tickets }: TicketListProps) {
  if (tickets.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Tickets</h3>
        <div className="text-center py-8">
          <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No support tickets yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Your Tickets</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {tickets.map((ticket) => {
          const statusConfig = STATUS_CONFIG[ticket.status];
          const StatusIcon = statusConfig.icon;

          return (
            <div
              key={ticket.id}
              className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}
                    >
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig.label}
                    </span>
                    <span className="text-xs text-gray-500">
                      {CATEGORY_LABELS[ticket.category] || ticket.category}
                    </span>
                  </div>
                  <p className="font-medium text-gray-900 truncate">
                    {ticket.subject}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(ticket.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
