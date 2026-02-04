'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  MessageSquare,
  Search,
  User,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Send,
  ChevronRight,
  Package,
  Phone,
  Mail,
} from 'lucide-react';

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  delivery_id: string | null;
  delivery_tracking: string | null;
  user_id: string;
  user_name: string;
  user_email: string;
  user_type: 'customer' | 'driver';
  created_at: string;
  updated_at: string;
  assigned_to: string | null;
  resolution: string | null;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_name: string;
  sender_type: 'user' | 'dispatcher';
  message: string;
  created_at: string;
}

const statusOptions = [
  { value: 'all', label: 'All Tickets' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const priorityOptions = [
  { value: 'all', label: 'All Priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const statusColors: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  resolved: 'bg-green-100 text-green-800 border-green-200',
  closed: 'bg-gray-100 text-gray-800 border-gray-200',
};

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-gray-100 text-gray-800',
};

export default function SupportPage() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchTickets();

    const supabase = createClient();
    const subscription = supabase
      .channel('support-tickets-page')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_tickets' },
        () => fetchTickets()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    if (selectedTicket) {
      fetchMessages(selectedTicket.id);
    }
  }, [selectedTicket]);

  const fetchTickets = async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from('support_tickets')
      .select(`
        id,
        subject,
        description,
        status,
        priority,
        category,
        delivery_id,
        user_id,
        created_at,
        updated_at,
        assigned_to,
        resolution,
        user:profiles!support_tickets_user_id_fkey(full_name, email),
        delivery:deliveries(tracking_number)
      `)
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    if (priorityFilter !== 'all') {
      query = query.eq('priority', priorityFilter);
    }

    const { data } = await query;

    if (data) {
      setTickets(
        data.map((t: any) => ({
          id: t.id,
          subject: t.subject,
          description: t.description,
          status: t.status,
          priority: t.priority,
          category: t.category,
          delivery_id: t.delivery_id,
          delivery_tracking: t.delivery?.tracking_number || null,
          user_id: t.user_id,
          user_name: t.user?.full_name || 'Unknown User',
          user_email: t.user?.email || '',
          user_type: t.category?.includes('driver') ? 'driver' : 'customer',
          created_at: t.created_at,
          updated_at: t.updated_at,
          assigned_to: t.assigned_to,
          resolution: t.resolution,
        }))
      );
    }

    setLoading(false);
  };

  const fetchMessages = async (ticketId: string) => {
    const supabase = createClient();

    // For now, we'll simulate messages since we'd need a ticket_messages table
    // In production, you'd fetch from a proper messages table
    setMessages([
      {
        id: '1',
        ticket_id: ticketId,
        sender_id: 'user',
        sender_name: selectedTicket?.user_name || 'User',
        sender_type: 'user',
        message: selectedTicket?.description || '',
        created_at: selectedTicket?.created_at || new Date().toISOString(),
      },
    ]);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedTicket) return;
    setUpdating(true);

    const supabase = createClient();
    await supabase
      .from('support_tickets')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedTicket.id);

    setSelectedTicket({ ...selectedTicket, status: newStatus });
    fetchTickets();
    setUpdating(false);
  };

  const handleSendMessage = async () => {
    if (!selectedTicket || !newMessage.trim()) return;
    setSending(true);

    // In production, save to ticket_messages table
    const newMsg: TicketMessage = {
      id: Date.now().toString(),
      ticket_id: selectedTicket.id,
      sender_id: 'dispatcher',
      sender_name: 'Support Team',
      sender_type: 'dispatcher',
      message: newMessage,
      created_at: new Date().toISOString(),
    };

    setMessages([...messages, newMsg]);
    setNewMessage('');

    // Update ticket status if it was open
    if (selectedTicket.status === 'open') {
      await handleUpdateStatus('in_progress');
    }

    setSending(false);
  };

  const filteredTickets = tickets.filter((ticket) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      ticket.subject.toLowerCase().includes(query) ||
      ticket.user_name.toLowerCase().includes(query) ||
      ticket.user_email.toLowerCase().includes(query) ||
      ticket.delivery_tracking?.toLowerCase().includes(query)
    );
  });

  const openCount = tickets.filter((t) => t.status === 'open').length;

  return (
    <div className="h-[calc(100vh-120px)] flex">
      {/* Tickets list */}
      <div className="w-full lg:w-96 border-r border-gray-200 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">Support Tickets</h1>
            <button
              onClick={fetchTickets}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {openCount > 0 && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {openCount} open ticket{openCount > 1 ? 's' : ''} need attention
                </span>
              </div>
            </div>
          )}

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary"
            >
              {priorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-epyc-primary" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageSquare className="h-10 w-10 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500">No tickets found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                    selectedTicket?.id === ticket.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-1">
                      {ticket.subject}
                    </h3>
                    <span className={`status-badge text-xs ${priorityColors[ticket.priority]}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                    {ticket.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`status-badge text-xs border ${statusColors[ticket.status]}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                      {ticket.delivery_tracking && (
                        <span className="text-xs text-gray-400">
                          {ticket.delivery_tracking}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ticket detail */}
      <div className="hidden lg:flex flex-1 flex-col bg-gray-50">
        {selectedTicket ? (
          <>
            {/* Ticket header */}
            <div className="bg-white border-b border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedTicket.subject}
                  </h2>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`status-badge border ${statusColors[selectedTicket.status]}`}>
                      {selectedTicket.status.replace('_', ' ')}
                    </span>
                    <span className={`status-badge ${priorityColors[selectedTicket.priority]}`}>
                      {selectedTicket.priority} priority
                    </span>
                    <span className="text-sm text-gray-500">
                      {selectedTicket.category}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && (
                    <button
                      onClick={() => handleUpdateStatus('resolved')}
                      disabled={updating}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                    >
                      <CheckCircle className="h-4 w-4 inline mr-1" />
                      Resolve
                    </button>
                  )}
                  {selectedTicket.status === 'resolved' && (
                    <button
                      onClick={() => handleUpdateStatus('closed')}
                      disabled={updating}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm"
                    >
                      Close Ticket
                    </button>
                  )}
                </div>
              </div>

              {/* User & Delivery info */}
              <div className="grid grid-cols-2 gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Customer</p>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium">{selectedTicket.user_name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <a
                      href={`mailto:${selectedTicket.user_email}`}
                      className="text-sm text-epyc-primary hover:text-blue-700"
                    >
                      {selectedTicket.user_email}
                    </a>
                  </div>
                </div>
                {selectedTicket.delivery_id && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Related Delivery</p>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-gray-400" />
                      <Link
                        href={`/deliveries/${selectedTicket.delivery_id}`}
                        className="text-sm text-epyc-primary hover:text-blue-700"
                      >
                        {selectedTicket.delivery_tracking}
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_type === 'dispatcher' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-lg rounded-xl p-4 ${
                      msg.sender_type === 'dispatcher'
                        ? 'bg-epyc-primary text-white'
                        : 'bg-white border border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-sm font-medium ${
                        msg.sender_type === 'dispatcher' ? 'text-blue-100' : 'text-gray-900'
                      }`}>
                        {msg.sender_name}
                      </span>
                      <span className={`text-xs ${
                        msg.sender_type === 'dispatcher' ? 'text-blue-200' : 'text-gray-400'
                      }`}>
                        {new Date(msg.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className={`text-sm whitespace-pre-wrap ${
                      msg.sender_type === 'dispatcher' ? 'text-white' : 'text-gray-700'
                    }`}>
                      {msg.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Reply input */}
            {selectedTicket.status !== 'closed' && (
              <div className="bg-white border-t border-gray-200 p-4">
                <div className="flex gap-3">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your response..."
                    rows={3}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="px-6 py-3 bg-epyc-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">Select a ticket to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
