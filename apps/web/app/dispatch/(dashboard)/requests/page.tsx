'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Inbox, Loader2, Mail, MapPin, Phone, RefreshCw } from 'lucide-react';
import { CONTACT_SUBJECTS, ITEM_TYPES, SERVICE_LEVELS, labelFor } from '@/lib/public-requests';

/**
 * Inbox for the two public forms: "Request a delivery" (delivery_requests)
 * and "Send us a message" (contact_messages). Staff only (RLS + middleware).
 * Every request is also emailed to the ops inbox when Resend is configured.
 */

interface DeliveryRequestRow {
  id: string;
  reference: string;
  status: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  company_name: string | null;
  pickup_address: string;
  dropoff_address: string;
  item_type: string;
  item_description: string | null;
  service_level: string;
  pickup_date: string | null;
  time_window: string | null;
  notes: string | null;
  created_at: string;
}

interface ContactMessageRow {
  id: string;
  status: string;
  full_name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  created_at: string;
}

const REQUEST_STATUSES = ['new', 'contacted', 'quoted', 'booked', 'declined', 'spam'] as const;
const MESSAGE_STATUSES = ['new', 'replied', 'closed', 'spam'] as const;

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-amber-100 text-amber-800',
  contacted: 'bg-blue-100 text-blue-800',
  quoted: 'bg-purple-100 text-purple-800',
  booked: 'bg-green-100 text-green-800',
  replied: 'bg-green-100 text-green-800',
  declined: 'bg-gray-200 text-gray-700',
  closed: 'bg-gray-200 text-gray-700',
  spam: 'bg-gray-200 text-gray-500',
};

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function RequestsPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<'deliveries' | 'messages'>('deliveries');
  const [showClosed, setShowClosed] = useState(false);
  const [requests, setRequests] = useState<DeliveryRequestRow[]>([]);
  const [messages, setMessages] = useState<ContactMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [r, m] = await Promise.all([
      supabase.from('delivery_requests').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    if (r.error || m.error) {
      const msg = (r.error || m.error)!.message;
      setError(
        /relation .* does not exist|schema cache/i.test(msg)
          ? 'The requests tables are not in the database yet. Apply migration 20261118000000_public_requests.sql in Supabase. Until then, requests arrive by email only.'
          : msg
      );
    }
    setRequests((r.data as DeliveryRequestRow[]) || []);
    setMessages((m.data as ContactMessageRow[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (table: 'delivery_requests' | 'contact_messages', id: string, status: string) => {
    setBusyId(id);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: updateError } = await supabase
      .from(table)
      .update({
        status,
        handled_by: user?.id ?? null,
        handled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (updateError) setError(updateError.message);
    setBusyId(null);
    load();
  };

  const openRequests = requests.filter((r) => showClosed || !['booked', 'declined', 'spam'].includes(r.status));
  const openMessages = messages.filter((m) => showClosed || !['closed', 'spam'].includes(m.status));
  const newRequests = requests.filter((r) => r.status === 'new').length;
  const newMessages = messages.filter((m) => m.status === 'new').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center">
          <Inbox className="h-7 w-7 text-epyc-primary mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Requests</h1>
            <p className="text-sm text-gray-500">Delivery requests and messages from the public website</p>
          </div>
        </div>
        <button onClick={load} className="btn btn-secondary inline-flex items-center" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {([
          ['deliveries', `Delivery requests${newRequests ? ` (${newRequests} new)` : ''}`],
          ['messages', `Messages${newMessages ? ` (${newMessages} new)` : ''}`],
        ] as const).map(([key, text]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === key ? 'bg-epyc-primary text-white' : 'bg-white border border-gray-300 text-gray-700'
            }`}
          >
            {text}
          </button>
        ))}
        <label className="ml-auto text-sm text-gray-600 flex items-center">
          <input type="checkbox" className="mr-2" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
          Show closed
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-epyc-primary" />
        </div>
      ) : tab === 'deliveries' ? (
        openRequests.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No delivery requests to show.</p>
        ) : (
          <ul className="space-y-4">
            {openRequests.map((r) => (
              <li key={r.id} className="card p-5">
                <div className="flex flex-wrap justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{r.contact_name}</span>
                      {r.company_name && <span className="text-gray-500 text-sm">{r.company_name}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[r.status] || ''}`}>
                        {titleCase(r.status)}
                      </span>
                      <span className="text-xs text-gray-400">{r.reference}</span>
                    </div>
                    <p className="text-sm text-gray-700 flex items-start">
                      <MapPin className="h-4 w-4 mr-1 mt-0.5 text-gray-400 flex-shrink-0" />
                      <span>
                        {r.pickup_address} <span className="text-gray-400">to</span> {r.dropoff_address}
                      </span>
                    </p>
                    <p className="text-sm text-gray-700">
                      {labelFor(ITEM_TYPES, r.item_type)}
                      {r.item_description ? `, ${r.item_description}` : ''}
                    </p>
                    <p className="text-sm text-gray-700">
                      {labelFor(SERVICE_LEVELS, r.service_level)}
                      {r.pickup_date ? `, ${r.pickup_date}` : ''}
                      {r.time_window ? `, ${r.time_window}` : ''}
                    </p>
                    {r.notes && <p className="text-sm text-gray-500 italic whitespace-pre-wrap">{r.notes}</p>}
                    <div className="flex gap-4 text-sm pt-1 flex-wrap">
                      <a href={`tel:${r.contact_phone}`} className="text-epyc-primary flex items-center">
                        <Phone className="h-4 w-4 mr-1" />
                        {r.contact_phone}
                      </a>
                      <a href={`mailto:${r.contact_email}?subject=${encodeURIComponent(`Your delivery request ${r.reference}`)}`} className="text-epyc-primary flex items-center">
                        <Mail className="h-4 w-4 mr-1" />
                        {r.contact_email}
                      </a>
                    </div>
                    <p className="text-xs text-gray-400">Received {new Date(r.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 items-start">
                    {REQUEST_STATUSES.filter((s) => s !== r.status).map((s) => (
                      <button
                        key={s}
                        disabled={busyId === r.id}
                        onClick={() => setStatus('delivery_requests', r.id, s)}
                        className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Mark {titleCase(s)}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : openMessages.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No messages to show.</p>
      ) : (
        <ul className="space-y-4">
          {openMessages.map((m) => (
            <li key={m.id} className="card p-5">
              <div className="flex flex-wrap justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{m.full_name}</span>
                    <span className="text-sm text-gray-500">{labelFor(CONTACT_SUBJECTS, m.subject)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[m.status] || ''}`}>
                      {titleCase(m.status)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{m.message}</p>
                  <div className="flex gap-4 text-sm pt-1 flex-wrap">
                    {m.phone && (
                      <a href={`tel:${m.phone}`} className="text-epyc-primary flex items-center">
                        <Phone className="h-4 w-4 mr-1" />
                        {m.phone}
                      </a>
                    )}
                    <a href={`mailto:${m.email}`} className="text-epyc-primary flex items-center">
                      <Mail className="h-4 w-4 mr-1" />
                      {m.email}
                    </a>
                  </div>
                  <p className="text-xs text-gray-400">Received {new Date(m.created_at).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-2 items-start">
                  {MESSAGE_STATUSES.filter((s) => s !== m.status).map((s) => (
                    <button
                      key={s}
                      disabled={busyId === m.id}
                      onClick={() => setStatus('contact_messages', m.id, s)}
                      className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Mark {titleCase(s)}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
