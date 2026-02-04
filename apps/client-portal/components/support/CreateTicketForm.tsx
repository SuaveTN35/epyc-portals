'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const TICKET_CATEGORIES = [
  { value: 'delivery_issue', label: 'Delivery Issue' },
  { value: 'billing', label: 'Billing Question' },
  { value: 'tracking', label: 'Tracking Problem' },
  { value: 'damage_claim', label: 'Damage Claim' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'other', label: 'Other' },
];

export function CreateTicketForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    category: '',
    subject: '',
    message: '',
    delivery_id: '',
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setSuccess(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    if (!formData.category || !formData.subject || !formData.message) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError('Please log in to submit a ticket');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from('support_tickets').insert({
      customer_id: user.id,
      category: formData.category,
      subject: formData.subject,
      message: formData.message,
      delivery_id: formData.delivery_id || null,
      status: 'open',
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setSuccess(true);
      setFormData({
        category: '',
        subject: '',
        message: '',
        delivery_id: '',
      });
      router.refresh();
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center">
          <Check className="h-4 w-4 mr-2" />
          Your ticket has been submitted. We&apos;ll respond shortly.
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Category <span className="text-red-500">*</span>
        </label>
        <select
          name="category"
          value={formData.category}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
        >
          <option value="">Select a category</option>
          {TICKET_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Subject <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="subject"
          value={formData.subject}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
          placeholder="Brief description of your issue"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tracking Number (Optional)
        </label>
        <input
          type="text"
          name="delivery_id"
          value={formData.delivery_id}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
          placeholder="EPYC1234"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Message <span className="text-red-500">*</span>
        </label>
        <textarea
          name="message"
          value={formData.message}
          onChange={handleChange}
          required
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
          placeholder="Please describe your issue in detail..."
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center px-6 py-2 bg-epyc-primary text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            Submit Request
          </>
        )}
      </button>
    </form>
  );
}
