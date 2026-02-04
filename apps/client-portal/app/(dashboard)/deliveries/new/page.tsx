'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MapPin,
  Package,
  Truck,
  Clock,
  Shield,
  Thermometer,
  ArrowRight,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  SERVICE_LEVEL_CONFIG,
  VEHICLE_CONFIG,
  calculateQuote,
  generateTrackingNumber,
  formatCurrency,
} from '@epyc/shared';
import type { ServiceLevel, VehicleType, QuoteRequest } from '@epyc/shared';

type Step = 'pickup' | 'delivery' | 'package' | 'quote' | 'confirm';

export default function NewDeliveryPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('pickup');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    // Pickup
    pickup_address: '',
    pickup_city: '',
    pickup_state: 'CA',
    pickup_zip: '',
    pickup_contact_name: '',
    pickup_contact_phone: '',
    pickup_instructions: '',
    // Delivery
    delivery_address: '',
    delivery_city: '',
    delivery_state: 'CA',
    delivery_zip: '',
    delivery_contact_name: '',
    delivery_contact_phone: '',
    delivery_instructions: '',
    // Package
    package_description: '',
    package_weight: 0,
    package_length: 0,
    package_width: 0,
    package_height: 0,
    requires_signature: true,
    is_fragile: false,
    is_medical: false,
    is_hipaa: false,
    requires_temperature_control: false,
    temperature_min: 2,
    temperature_max: 8,
    // Service
    service_level: 'standard' as ServiceLevel,
    vehicle_required: 'car' as VehicleType,
  });

  // Quote result
  const [quote, setQuote] = useState<ReturnType<typeof calculateQuote> | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: parseFloat(value) || 0,
    }));
  };

  const calculateDeliveryQuote = () => {
    // Mock distance for now (would use Google Maps API)
    const mockDistance = 15; // miles

    const quoteRequest: QuoteRequest = {
      pickup_address: formData.pickup_address,
      pickup_city: formData.pickup_city,
      pickup_state: formData.pickup_state,
      pickup_zip: formData.pickup_zip,
      delivery_address: formData.delivery_address,
      delivery_city: formData.delivery_city,
      delivery_state: formData.delivery_state,
      delivery_zip: formData.delivery_zip,
      package_weight: formData.package_weight,
      package_length: formData.package_length,
      package_width: formData.package_width,
      package_height: formData.package_height,
      service_level: formData.service_level,
      vehicle_required: formData.vehicle_required,
      is_medical: formData.is_medical,
      is_hipaa: formData.is_hipaa,
      requires_temperature_control: formData.requires_temperature_control,
      temperature_min: formData.temperature_min,
      temperature_max: formData.temperature_max,
    };

    const result = calculateQuote(quoteRequest, mockDistance);
    setQuote(result);
    setStep('quote');
  };

  const handleSubmit = async () => {
    if (!quote) return;

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('You must be logged in to create a delivery');
      setLoading(false);
      return;
    }

    const trackingNumber = generateTrackingNumber();

    const { error: insertError } = await supabase.from('deliveries').insert({
      tracking_number: trackingNumber,
      customer_id: user.id,
      status: 'booked',
      // Pickup
      pickup_address: formData.pickup_address,
      pickup_city: formData.pickup_city,
      pickup_state: formData.pickup_state,
      pickup_zip: formData.pickup_zip,
      pickup_contact_name: formData.pickup_contact_name,
      pickup_contact_phone: formData.pickup_contact_phone,
      pickup_instructions: formData.pickup_instructions,
      // Delivery
      delivery_address: formData.delivery_address,
      delivery_city: formData.delivery_city,
      delivery_state: formData.delivery_state,
      delivery_zip: formData.delivery_zip,
      delivery_contact_name: formData.delivery_contact_name,
      delivery_contact_phone: formData.delivery_contact_phone,
      delivery_instructions: formData.delivery_instructions,
      // Package
      package_description: formData.package_description,
      package_weight: formData.package_weight,
      package_length: formData.package_length,
      package_width: formData.package_width,
      package_height: formData.package_height,
      requires_signature: formData.requires_signature,
      is_fragile: formData.is_fragile,
      is_medical: formData.is_medical,
      is_hipaa: formData.is_hipaa,
      requires_temperature_control: formData.requires_temperature_control,
      temperature_min: formData.requires_temperature_control ? formData.temperature_min : null,
      temperature_max: formData.requires_temperature_control ? formData.temperature_max : null,
      // Pricing
      distance_miles: quote.distance_miles,
      estimated_duration_minutes: quote.estimated_duration_minutes,
      base_price: quote.base_price,
      distance_price: quote.distance_price,
      weight_surcharge: quote.weight_surcharge,
      rush_surcharge: quote.rush_surcharge,
      hipaa_surcharge: quote.hipaa_surcharge,
      temperature_surcharge: quote.temperature_surcharge,
      total_price: quote.total_price,
      driver_payout: quote.driver_payout,
      // Service
      service_level: formData.service_level,
      vehicle_required: quote.vehicle_required,
      booked_at: new Date().toISOString(),
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setStep('confirm');
    setTimeout(() => {
      router.push('/deliveries');
    }, 3000);
  };

  const steps = [
    { id: 'pickup', label: 'Pickup' },
    { id: 'delivery', label: 'Delivery' },
    { id: 'package', label: 'Package' },
    { id: 'quote', label: 'Quote' },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">New Delivery</h1>
      <p className="text-gray-600 mb-8">Book a same-day delivery in just a few steps.</p>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((s, index) => (
            <div key={s.id} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s.id || steps.findIndex((x) => x.id === step) > index
                    ? 'bg-epyc-primary text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {index + 1}
              </div>
              <span className="ml-2 text-sm font-medium text-gray-700 hidden sm:block">
                {s.label}
              </span>
              {index < steps.length - 1 && (
                <div className="w-12 sm:w-24 h-0.5 bg-gray-200 mx-2" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg shadow p-6">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Pickup Step */}
        {step === 'pickup' && (
          <div className="space-y-6">
            <div className="flex items-center mb-4">
              <MapPin className="h-6 w-6 text-epyc-primary mr-2" />
              <h2 className="text-lg font-semibold">Pickup Location</h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Street Address
              </label>
              <input
                type="text"
                name="pickup_address"
                value={formData.pickup_address}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
                placeholder="123 Main Street"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  name="pickup_city"
                  value={formData.pickup_city}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
                  placeholder="Los Angeles"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <select
                  name="pickup_state"
                  value={formData.pickup_state}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
                >
                  <option value="CA">CA</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                <input
                  type="text"
                  name="pickup_zip"
                  value={formData.pickup_zip}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
                  placeholder="90001"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Name
                </label>
                <input
                  type="text"
                  name="pickup_contact_name"
                  value={formData.pickup_contact_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  name="pickup_contact_phone"
                  value={formData.pickup_contact_phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pickup Instructions (Optional)
              </label>
              <textarea
                name="pickup_instructions"
                value={formData.pickup_instructions}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
                placeholder="e.g., Use back entrance, ask for reception"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setStep('delivery')}
                className="flex items-center px-6 py-2 bg-epyc-primary text-white rounded-lg hover:bg-blue-700"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Delivery Step */}
        {step === 'delivery' && (
          <div className="space-y-6">
            <div className="flex items-center mb-4">
              <MapPin className="h-6 w-6 text-epyc-accent mr-2" />
              <h2 className="text-lg font-semibold">Delivery Location</h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Street Address
              </label>
              <input
                type="text"
                name="delivery_address"
                value={formData.delivery_address}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
                placeholder="456 Oak Avenue"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  name="delivery_city"
                  value={formData.delivery_city}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
                  placeholder="Santa Monica"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <select
                  name="delivery_state"
                  value={formData.delivery_state}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
                >
                  <option value="CA">CA</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                <input
                  type="text"
                  name="delivery_zip"
                  value={formData.delivery_zip}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
                  placeholder="90401"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Name
                </label>
                <input
                  type="text"
                  name="delivery_contact_name"
                  value={formData.delivery_contact_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  name="delivery_contact_phone"
                  value={formData.delivery_contact_phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
                  placeholder="(555) 987-6543"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Instructions (Optional)
              </label>
              <textarea
                name="delivery_instructions"
                value={formData.delivery_instructions}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
                placeholder="e.g., Leave at front desk, call upon arrival"
              />
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep('pickup')}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep('package')}
                className="flex items-center px-6 py-2 bg-epyc-primary text-white rounded-lg hover:bg-blue-700"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Package Step */}
        {step === 'package' && (
          <div className="space-y-6">
            <div className="flex items-center mb-4">
              <Package className="h-6 w-6 text-epyc-primary mr-2" />
              <h2 className="text-lg font-semibold">Package Details</h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Package Description
              </label>
              <input
                type="text"
                name="package_description"
                value={formData.package_description}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
                placeholder="e.g., Medical samples, legal documents"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weight (lbs)
                </label>
                <input
                  type="number"
                  name="package_weight"
                  value={formData.package_weight || ''}
                  onChange={handleNumberChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Length (in)</label>
                <input
                  type="number"
                  name="package_length"
                  value={formData.package_length || ''}
                  onChange={handleNumberChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Width (in)</label>
                <input
                  type="number"
                  name="package_width"
                  value={formData.package_width || ''}
                  onChange={handleNumberChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Height (in)</label>
                <input
                  type="number"
                  name="package_height"
                  value={formData.package_height || ''}
                  onChange={handleNumberChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-epyc-primary focus:border-epyc-primary"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Service Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Service Level</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(SERVICE_LEVEL_CONFIG).map(([key, config]) => (
                  <label
                    key={key}
                    className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                      formData.service_level === key
                        ? 'border-epyc-primary bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="service_level"
                      value={key}
                      checked={formData.service_level === key}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <Clock className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="font-medium text-gray-900">{config.label}</p>
                      <p className="text-sm text-gray-500">{config.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Vehicle Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(VEHICLE_CONFIG).map(([key, config]) => (
                  <label
                    key={key}
                    className={`flex flex-col items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                      formData.vehicle_required === key
                        ? 'border-epyc-primary bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="vehicle_required"
                      value={key}
                      checked={formData.vehicle_required === key}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <span className="text-2xl mb-1">{config.icon}</span>
                    <p className="font-medium text-gray-900 text-sm">{config.label}</p>
                    <p className="text-xs text-gray-500">Up to {config.maxWeight} lbs</p>
                  </label>
                ))}
              </div>
            </div>

            {/* Special Requirements */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Special Requirements
              </label>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="requires_signature"
                    checked={formData.requires_signature}
                    onChange={handleChange}
                    className="h-4 w-4 text-epyc-primary focus:ring-epyc-primary border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Signature required</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="is_fragile"
                    checked={formData.is_fragile}
                    onChange={handleChange}
                    className="h-4 w-4 text-epyc-primary focus:ring-epyc-primary border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Fragile item</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="is_medical"
                    checked={formData.is_medical}
                    onChange={handleChange}
                    className="h-4 w-4 text-epyc-primary focus:ring-epyc-primary border-gray-300 rounded"
                  />
                  <Shield className="ml-2 h-4 w-4 text-blue-500" />
                  <span className="ml-1 text-sm text-gray-700">Medical delivery</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="is_hipaa"
                    checked={formData.is_hipaa}
                    onChange={handleChange}
                    className="h-4 w-4 text-epyc-primary focus:ring-epyc-primary border-gray-300 rounded"
                  />
                  <Shield className="ml-2 h-4 w-4 text-green-500" />
                  <span className="ml-1 text-sm text-gray-700">HIPAA compliant (PHI)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="requires_temperature_control"
                    checked={formData.requires_temperature_control}
                    onChange={handleChange}
                    className="h-4 w-4 text-epyc-primary focus:ring-epyc-primary border-gray-300 rounded"
                  />
                  <Thermometer className="ml-2 h-4 w-4 text-cyan-500" />
                  <span className="ml-1 text-sm text-gray-700">Temperature controlled</span>
                </label>
              </div>
            </div>

            {formData.requires_temperature_control && (
              <div className="bg-cyan-50 rounded-lg p-4">
                <p className="text-sm font-medium text-cyan-800 mb-2">Temperature Range</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-cyan-600 mb-1">Min (°C)</label>
                    <input
                      type="number"
                      name="temperature_min"
                      value={formData.temperature_min}
                      onChange={handleNumberChange}
                      className="w-full px-3 py-2 border border-cyan-200 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-cyan-600 mb-1">Max (°C)</label>
                    <input
                      type="number"
                      name="temperature_max"
                      value={formData.temperature_max}
                      onChange={handleNumberChange}
                      className="w-full px-3 py-2 border border-cyan-200 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep('delivery')}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={calculateDeliveryQuote}
                className="flex items-center px-6 py-2 bg-epyc-primary text-white rounded-lg hover:bg-blue-700"
              >
                Get Quote
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Quote Step */}
        {step === 'quote' && quote && (
          <div className="space-y-6">
            <div className="flex items-center mb-4">
              <Truck className="h-6 w-6 text-epyc-accent mr-2" />
              <h2 className="text-lg font-semibold">Your Quote</h2>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-600">Distance</span>
                <span className="font-medium">{quote.distance_miles.toFixed(1)} miles</span>
              </div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-600">Estimated Time</span>
                <span className="font-medium">{quote.estimated_duration_minutes} min</span>
              </div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-600">Vehicle</span>
                <span className="font-medium">
                  {VEHICLE_CONFIG[quote.vehicle_required].icon}{' '}
                  {VEHICLE_CONFIG[quote.vehicle_required].label}
                </span>
              </div>

              <hr className="my-4" />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Base Rate</span>
                  <span>{formatCurrency(quote.base_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Distance ({quote.distance_miles.toFixed(1)} mi)</span>
                  <span>{formatCurrency(quote.distance_price)}</span>
                </div>
                {quote.weight_surcharge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Weight Surcharge</span>
                    <span>{formatCurrency(quote.weight_surcharge)}</span>
                  </div>
                )}
                {quote.hipaa_surcharge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">HIPAA Compliance</span>
                    <span>{formatCurrency(quote.hipaa_surcharge)}</span>
                  </div>
                )}
                {quote.temperature_surcharge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Temperature Control</span>
                    <span>{formatCurrency(quote.temperature_surcharge)}</span>
                  </div>
                )}
                {quote.rush_surcharge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Rush Service</span>
                    <span>{formatCurrency(quote.rush_surcharge)}</span>
                  </div>
                )}
              </div>

              <hr className="my-4" />

              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Total</span>
                <span className="text-2xl font-bold text-epyc-primary">
                  {formatCurrency(quote.total_price)}
                </span>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep('package')}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center px-6 py-2 bg-epyc-accent text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Book Delivery
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Confirmation Step */}
        {step === 'confirm' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Delivery Booked!</h2>
            <p className="text-gray-600 mb-4">
              Your delivery has been scheduled. A driver will be assigned shortly.
            </p>
            <p className="text-sm text-gray-500">Redirecting to your deliveries...</p>
          </div>
        )}
      </div>
    </div>
  );
}
