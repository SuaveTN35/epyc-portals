import Link from 'next/link';
import { FileText, ArrowRight, Clock, Truck, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatCurrency, VEHICLE_CONFIG, SERVICE_LEVEL_CONFIG } from '@epyc/shared';
import type { VehicleType, ServiceLevel } from '@epyc/shared';

async function getQuotes() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // Get deliveries in quote_requested or quoted status
  const { data } = await supabase
    .from('deliveries')
    .select('*')
    .eq('customer_id', user.id)
    .in('status', ['quote_requested', 'quoted'])
    .order('created_at', { ascending: false })
    .limit(50);

  return data || [];
}

export default async function QuotesPage() {
  const quotes = await getQuotes();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Saved Quotes</h1>
          <p className="text-gray-600">View and convert your saved quotes to deliveries</p>
        </div>
        <Link
          href="/deliveries/new"
          className="flex items-center px-4 py-2 bg-epyc-primary text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Quote
        </Link>
      </div>

      {quotes.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No saved quotes</h3>
          <p className="text-gray-500 mb-6">
            Start by creating a new delivery to get a quote
          </p>
          <Link
            href="/deliveries/new"
            className="inline-flex items-center px-6 py-3 bg-epyc-primary text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            Get a Quote
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="divide-y divide-gray-200">
            {quotes.map((quote) => {
              const vehicleConfig = quote.vehicle_required
                ? VEHICLE_CONFIG[quote.vehicle_required as VehicleType]
                : null;
              const serviceConfig = quote.service_level
                ? SERVICE_LEVEL_CONFIG[quote.service_level as ServiceLevel]
                : null;

              return (
                <div
                  key={quote.id}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <FileText className="h-5 w-5 text-gray-400" />
                        <span className="font-medium text-gray-900">
                          {quote.tracking_number || `Quote #${quote.id.slice(0, 8)}`}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            quote.status === 'quoted'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {quote.status === 'quoted' ? 'Ready' : 'Pending'}
                        </span>
                      </div>

                      <div className="text-sm text-gray-600">
                        <p className="truncate">
                          {quote.pickup_address}, {quote.pickup_city}
                        </p>
                        <p className="text-gray-400 flex items-center">
                          <ArrowRight className="h-3 w-3 mx-1" />
                        </p>
                        <p className="truncate">
                          {quote.delivery_address}, {quote.delivery_city}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                        {vehicleConfig && (
                          <span className="flex items-center">
                            <Truck className="h-3 w-3 mr-1" />
                            {vehicleConfig.icon} {vehicleConfig.label}
                          </span>
                        )}
                        {serviceConfig && (
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {serviceConfig.label}
                          </span>
                        )}
                        <span>
                          Created {new Date(quote.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-epyc-primary">
                          {formatCurrency(quote.total_price || 0)}
                        </p>
                        {quote.distance_miles && (
                          <p className="text-sm text-gray-500">
                            {quote.distance_miles.toFixed(1)} miles
                          </p>
                        )}
                      </div>

                      <Link
                        href={`/deliveries/new?from_quote=${quote.id}`}
                        className="flex items-center px-4 py-2 bg-epyc-accent text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium"
                      >
                        Book Now
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
