import { HelpCircle, MessageSquare, Phone, Mail, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { CreateTicketForm } from '@/components/support/CreateTicketForm';
import { TicketList } from '@/components/support/TicketList';
import { FAQAccordion } from '@/components/support/FAQAccordion';

async function getSupportTickets() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return data || [];
}

const FAQ_ITEMS = [
  {
    question: 'How do I track my delivery?',
    answer:
      'You can track your delivery in real-time from the "Tracking" page in your dashboard. You can also use the public tracking page by entering your tracking number (EPYC####).',
  },
  {
    question: 'What are your service areas?',
    answer:
      'We currently serve the Los Angeles metropolitan area including Los Angeles County, Orange County, San Diego County, and the Inland Empire. Contact us for service to other areas.',
  },
  {
    question: 'How is pricing calculated?',
    answer:
      'Pricing is based on distance, vehicle type, service level, and any special requirements (HIPAA compliance, temperature control, etc.). You can get an instant quote when booking a delivery.',
  },
  {
    question: 'What if my delivery is damaged or lost?',
    answer:
      'All deliveries include basic insurance coverage. For high-value items, we recommend declaring the value at booking for additional coverage. Contact support immediately if your delivery is damaged or lost.',
  },
  {
    question: 'Can I cancel a delivery?',
    answer:
      'Yes, you can cancel a delivery before a driver is assigned for a full refund. If a driver has already been assigned, a partial refund may apply. Cancel from the delivery details page.',
  },
  {
    question: 'Do you offer HIPAA-compliant deliveries?',
    answer:
      'Yes! EPYC Courier Service offers HIPAA-compliant medical courier services. Select the HIPAA option when booking, and a trained driver will handle your sensitive medical deliveries.',
  },
];

export default async function SupportPage() {
  const tickets = await getSupportTickets();

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Support</h1>
      <p className="text-gray-600 mb-8">Get help with your deliveries</p>

      {/* Contact Options */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <a
          href="tel:8182170070"
          className="flex items-center p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <div className="w-10 h-10 bg-epyc-primary/10 rounded-full flex items-center justify-center mr-3">
            <Phone className="h-5 w-5 text-epyc-primary" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Call Us</p>
            <p className="text-sm text-gray-500">(818) 217-0070</p>
          </div>
        </a>

        <a
          href="mailto:support@epyccs.com"
          className="flex items-center p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <div className="w-10 h-10 bg-epyc-primary/10 rounded-full flex items-center justify-center mr-3">
            <Mail className="h-5 w-5 text-epyc-primary" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Email</p>
            <p className="text-sm text-gray-500">support@epyccs.com</p>
          </div>
        </a>

        <div className="flex items-center p-4 bg-white rounded-lg shadow">
          <div className="w-10 h-10 bg-epyc-primary/10 rounded-full flex items-center justify-center mr-3">
            <MessageSquare className="h-5 w-5 text-epyc-primary" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Live Chat</p>
            <p className="text-sm text-gray-500">Mon-Fri, 8am-6pm</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Create Ticket & Ticket List */}
        <div className="space-y-6">
          {/* Create Ticket */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center">
              <Plus className="h-5 w-5 text-gray-400 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">
                Submit a Request
              </h2>
            </div>
            <div className="p-6">
              <CreateTicketForm />
            </div>
          </div>

          {/* Ticket List */}
          <TicketList tickets={tickets} />
        </div>

        {/* Right Column: FAQ */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center">
            <HelpCircle className="h-5 w-5 text-gray-400 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="p-6">
            <FAQAccordion items={FAQ_ITEMS} />
          </div>
        </div>
      </div>
    </div>
  );
}
