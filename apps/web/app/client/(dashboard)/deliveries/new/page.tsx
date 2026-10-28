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
  CreditCard,
} from 'lucide-react';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import { PaymentStep } from '@/components/booking/PaymentStep';
import type { CustomerQuote } from '@/lib/customer-booking';
import { SERVICE_LEVEL_CONFIG, VEHICLE_CONFIG, formatCurrency } from '@epyc/shared';
import type { ServiceLevel, VehicleType } from '@epyc/shared';

type Step = 'pickup' | 'delivery' | 'package' | 'quote' | 'payment' | 'confirm';

interface Coordinates {
  lat: number;
  lng: number;
}

export default function NewDeliveryPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('pickup');
  const [loading, setLoading] = useState(false);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Coordinates for distance calculation
  const [pickupCoords, setPickupCoords] = useState<Coordinates | null>(null);
  const [deliveryCoords, setDeliveryCoords] = useState<Coordinates | null>(null);

  // Delivery booking state
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState<string | null>(null);

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

  // Quote result. Always the SERVER quote (POST /api/client/deliveries);
  // the browser never computes or sends a price.
  const [quote, setQuote] = useState<CustomerQuote | null>(null);

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

  const handlePickupAddressSelect = (data: {
    address: string;
    city: string;
    state: string;
    zip: string;
    lat: number;
    lng: number;
  }) => {
    setFormData((prev) => ({
      ...prev,
      pickup_address: data.address,
      pickup_city: data.city,
      pickup_state: data.state,
      pickup_zip: data.zip,
    }));
    setPickupCoords({ lat: data.lat, lng: data.lng });
  };

  const handleDeliveryAddressSelect = (data: {
    address: string;
    city: string;
    state: string;
    zip: string;
    lat: number;
    lng: number;
  }) => {
    setFormData((prev) => ({
      ...prev,
      delivery_address: data.address,
      delivery_city: data.city,
      delivery_state: data.state,
      delivery_zip: data.zip,
    }));
    setDeliveryCoords({ lat: data.lat, lng: data.lng });
  };

  // Booking payload: the form plus the coordinates picked from the address
  // suggestions. No price field: the server prices the route itself.
  const bookingPayload = (quoteOnly: boolean) => ({
    ...formData,
    pickup_lat: pickupCoords?.lat ?? null,
    pickup_lng: pickupCoords?.lng ?? null,
    delivery_lat: deliveryCoords?.lat ?? null,
    delivery_lng: deliveryCoords?.lng ?? null,
    quote_only: quoteOnly,
  });

  const postBooking = async (quoteOnly: boolean) => {
    const response = await fetch('/api/client/deliveries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingPayload(quoteOnly)),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || 'Something went wrong. Try again.');
    }
    return data as { quote: CustomerQuote; id?: string; tracking_number?: string };
  };

  const calculateDeliveryQuote = async () => {
    setError(null);

    // Validate required fields
    if (!formData.pickup_address || !formData.pickup_city || !formData.pickup_zip) {
      setError('Please complete the pickup address');
      return;
    }
    if (!formData.delivery_address || !formData.delivery_city || !formData.delivery_zip) {
      setError('Please complete the delivery address');
      return;
    }
    if (!pickupCoords) {
      setError('Pickup address: pick the address from the suggestions list so we can price the route.');
      setStep('pickup');
      return;
    }
    if (!deliveryCoords) {
      setError('Delivery address: pick the address from the suggestions list so we can price the route.');
      setStep('delivery');
      return;
    }

    setCalculatingDistance(true);
    try {
      const data = await postBooking(true);
      setQuote(data.quote);
      setStep('quote');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get a quote. Try again.');
    } finally {
      setCalculatingDistance(false);
    }
  };

  // Create delivery (server prices and inserts) and proceed to payment
  const handleProceedToPayment = async () => {
    if (!quote) return;

    setLoading(true);
    setError(null);

    try {
      const data = await postBooking(false);
      if (!data.id || !data.tracking_number) {
        throw new Error('Failed to create delivery');
      }
      // The stored price is the one the payment step charges.
      setQuote(data.quote);
      setDeliveryId(data.id);
      setTrackingNumber(data.tracking_number);
      setStep('payment');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create delivery');
    } finally {
      setLoading(false);
    }
  };

  // Handle payment success - move to confirmation
  const handlePaymentSuccess = () => {
    setStep('confirm');
    setTimeout(() => {
      router.push('/client/deliveries');
    }, 3000);
  };

  // Skip payment (for testing or pay-later scenarios)
  const handleSkipPayment = async () => {
    setStep('confirm');
    setTimeout(() => {
      router.push('/client/deliveries');
    }, 3000);
  };

  const steps = [
    { id: 'pickup', label: 'Pickup' },
    { id: 'delivery', label: 'Delivery' },
    { id: 'package', label: 'Package' },
    { id: 'quote', label: 'Quote' },
    { id: 'payment', label: 'Payment' },
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

            <AddressAutocomplete
              id="pickup_address"
              label="Street Address"
              placeholder="Start typing an address..."
              value={formData.pickup_address}
              onChange={(value) => {
                setFormData((prev) => ({ ...prev, pickup_address: value }));
                // Typed text no longer matches the picked point; re-pick to price.
                setPickupCoords(null);
              }}
              onAddressSelect={handlePickupAddressSelect}
              required
            />

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
                className="flex items-center px-6 py-2 bg-epyc-primary text-white rounded-lg hover:bg-epyc-secondary transition-colors"
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

            <AddressAutocomplete
              id="delivery_address"
              label="Street Address"
              placeholder="Start typing an address..."
              value={formData.delivery_address}
              onChange={(value) => {
                setFormData((prev) => ({ ...prev, delivery_address: value }));
                // Typed text no longer matches the picked point; re-pick to price.
                setDeliveryCoords(null);
              }}
              onAddressSelect={handleDeliveryAddressSelect}
              required
            />

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
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep('package')}
                className="flex items-center px-6 py-2 bg-epyc-primary text-white rounded-lg hover:bg-epyc-secondary transition-colors"
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
                        ? 'border-epyc-primary bg-emerald-50'
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
                        ? 'border-epyc-primary bg-emerald-50'
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
                    <label className="block text-xs text-cyan-600 mb-1">Min (C)</label>
                    <input
                      type="number"
                      name="temperature_min"
                      value={formData.temperature_min}
                      onChange={handleNumberChange}
                      className="w-full px-3 py-2 border border-cyan-200 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-cyan-600 mb-1">Max (C)</label>
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
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={calculateDeliveryQuote}
                disabled={calculatingDistance}
                className="flex items-center px-6 py-2 bg-epyc-primary text-white rounded-lg hover:bg-epyc-secondary transition-colors disabled:opacity-50"
              >
                {calculatingDistance ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    Get Quote
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
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
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleProceedToPayment}
                disabled={loading}
                className="flex items-center px-6 py-2 bg-epyc-accent text-white rounded-lg hover:bg-epyc-secondary transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Proceed to Payment
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Payment Step */}
        {step === 'payment' && deliveryId && quote && trackingNumber && (
          <PaymentStep
            deliveryId={deliveryId}
            amount={quote.total_price}
            trackingNumber={trackingNumber}
            onSuccess={handlePaymentSuccess}
            onBack={() => setStep('quote')}
          />
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
