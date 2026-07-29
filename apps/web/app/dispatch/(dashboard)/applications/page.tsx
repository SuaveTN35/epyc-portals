'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  ClipboardList,
  Search,
  Phone,
  Mail,
  FileText,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Clock,
} from 'lucide-react';

interface DriverApplication {
  id: string;
  profile_id: string | null;
  full_name: string | null;
  email: string;
  phone: string | null;
  status: string;
  profile_photo_path: string | null;
  license_front_path: string | null;
  license_back_path: string | null;
  source: string;
  notes: string | null;
  contacted_at: string | null;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'screening', label: 'Screening' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

const STATUS_STYLES: Record<string, string> = {
  pending_review: 'bg-amber-100 text-amber-800',
  contacted: 'bg-blue-100 text-blue-800',
  screening: 'bg-purple-100 text-purple-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-gray-200 text-gray-700',
  withdrawn: 'bg-gray-200 text-gray-700',
};

function daysWaiting(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

export default function DriverApplicationsPage() {
  const supabase = createClient();

  const [applications, setApplications] = useState<DriverApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('pending_review');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('driver_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error: queryError } = await query;

    if (queryError) {
      setError(queryError.message);
      setApplications([]);
    } else {
      setApplications((data as DriverApplication[]) || []);
    }
    setLoading(false);
  }, [supabase, statusFilter]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const updateStatus = async (id: string, status: string) => {
    setBusyId(id);
    const patch: Record<string, string> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === 'contacted') {
      patch.contacted_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('driver_applications')
      .update(patch)
      .eq('id', id);

    if (updateError) {
      setError(updateError.message);
    }
    setBusyId(null);
    fetchApplications();
  };

  /** Documents live in a private bucket; mint a short-lived link on demand. */
  const openDocument = async (path: string | null) => {
    if (!path) return;
    try {
      const res = await fetch('/api/documents/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError('Could not open document.');
        return;
      }
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch {
      setError('Could not open document.');
    }
  };

  const term = search.trim().toLowerCase();
  const visible = term
    ? applications.filter((a) =>
        [a.full_name, a.email, a.phone]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(term))
      )
    : applications;

  const pendingCount = applications.filter(
    (a) => a.status === 'pending_review'
  ).length;

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <ClipboardList className="h-6 w-6 mr-2 text-epyc-primary" />
            Driver Applications
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Applications submitted at epyccs.com. An applicant has not supplied vehicle or
            insurance details until they complete onboarding.
          </p>
        </div>
        <button
          onClick={fetchApplications}
          className="btn border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {pendingCount > 0 && statusFilter === 'pending_review' && (
        <div className="mb-5 flex items-start bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-900">
            <strong>{pendingCount}</strong>{' '}
            {pendingCount === 1 ? 'application is' : 'applications are'} waiting for review.
            Applicants who wait more than two days usually take other work.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or phone"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-epyc-primary" />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p>No applications match this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((a) => {
            const waiting = daysWaiting(a.created_at);
            return (
              <div
                key={a.id}
                className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-[240px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-900 text-lg">
                        {a.full_name || '(no name given)'}
                      </h3>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          STATUS_STYLES[a.status] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {a.status.replace('_', ' ')}
                      </span>
                      {a.status === 'pending_review' && waiting > 2 && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {waiting}d waiting
                        </span>
                      )}
                    </div>

                    <div className="mt-2 space-y-1 text-sm">
                      {a.phone && (
                        <a
                          href={`tel:${a.phone.replace(/[^0-9]/g, '')}`}
                          className="flex items-center text-epyc-primary font-medium hover:underline"
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          {a.phone}
                        </a>
                      )}
                      <a
                        href={`mailto:${a.email}`}
                        className="flex items-center text-gray-600 hover:underline"
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        {a.email}
                      </a>
                      <p className="text-gray-400 text-xs pt-1">
                        Applied {new Date(a.created_at).toLocaleDateString()} via {a.source}
                      </p>
                    </div>

                    {a.notes && (
                      <p className="mt-2 text-xs text-gray-500 italic max-w-lg">{a.notes}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 items-stretch">
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { label: 'Photo', path: a.profile_photo_path },
                        { label: 'License Front', path: a.license_front_path },
                        { label: 'License Back', path: a.license_back_path },
                      ].map((doc) => (
                        <button
                          key={doc.label}
                          disabled={!doc.path}
                          onClick={() => openDocument(doc.path)}
                          className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center"
                        >
                          <FileText className="h-3.5 w-3.5 mr-1.5" />
                          {doc.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-2 flex-wrap justify-end">
                      {a.status === 'pending_review' && (
                        <button
                          disabled={busyId === a.id}
                          onClick={() => updateStatus(a.id, 'contacted')}
                          className="text-xs px-3 py-1.5 rounded-lg bg-epyc-primary text-white hover:bg-epyc-secondary disabled:opacity-50"
                        >
                          Mark Contacted
                        </button>
                      )}
                      {['pending_review', 'contacted', 'screening'].includes(a.status) && (
                        <button
                          disabled={busyId === a.id}
                          onClick={() => updateStatus(a.id, 'rejected')}
                          className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
