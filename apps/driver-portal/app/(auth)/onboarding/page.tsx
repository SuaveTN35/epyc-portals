'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Car,
  FileText,
  Shield,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Camera,
} from 'lucide-react';
import Image from 'next/image';
import { VEHICLE_CONFIG } from '@epyc/shared';
import type { VehicleType } from '@epyc/shared';
import DocumentUpload from '@/components/DocumentUpload';

type Step = 'vehicle' | 'license' | 'documents' | 'photos' | 'review';

export default function DriverOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('vehicle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    // Vehicle
    vehicle_type: 'car' as VehicleType,
    vehicle_make: '',
    vehicle_model: '',
    vehicle_year: new Date().getFullYear(),
    vehicle_plate: '',
    vehicle_vin: '',
    vehicle_length: '',
    vehicle_width: '',
    vehicle_height: '',
    cargo_capacity: '',
    has_temperature_control: false,
    // License
    license_number: '',
    license_state: 'CA',
    license_expiry: '',
    // Insurance
    insurance_policy: '',
    insurance_expiry: '',
    // Document URLs
    license_front_url: '',
    license_back_url: '',
    insurance_card_url: '',
    registration_url: '',
    vehicle_photo_front_url: '',
    vehicle_photo_back_url: '',
    vehicle_photo_side_url: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('Please sign in to continue');
      setLoading(false);
      return;
    }

    // Get max weight capacity based on vehicle type
    const vehicleConfig = VEHICLE_CONFIG[formData.vehicle_type];
    const maxWeightCapacity = vehicleConfig?.maxWeight || 50;

    // Create driver record
    const { error: insertError } = await supabase.from('drivers').insert({
      profile_id: user.id,
      vehicle_type: formData.vehicle_type,
      vehicle_make: formData.vehicle_make,
      vehicle_model: formData.vehicle_model,
      vehicle_year: formData.vehicle_year,
      vehicle_plate: formData.vehicle_plate,
      vehicle_vin: formData.vehicle_vin || null,
      vehicle_length: formData.vehicle_length ? parseFloat(formData.vehicle_length) : null,
      vehicle_width: formData.vehicle_width ? parseFloat(formData.vehicle_width) : null,
      vehicle_height: formData.vehicle_height ? parseFloat(formData.vehicle_height) : null,
      cargo_capacity: formData.cargo_capacity ? parseInt(formData.cargo_capacity) : null,
      has_temperature_control: formData.has_temperature_control,
      license_number: formData.license_number,
      license_state: formData.license_state,
      license_expiry: formData.license_expiry,
      insurance_policy: formData.insurance_policy,
      insurance_expiry: formData.insurance_expiry || null,
      max_weight_capacity: maxWeightCapacity,
      background_check_status: 'pending',
      // Document URLs
      license_front_url: formData.license_front_url || null,
      license_back_url: formData.license_back_url || null,
      insurance_card_url: formData.insurance_card_url || null,
      registration_url: formData.registration_url || null,
      vehicle_photo_front_url: formData.vehicle_photo_front_url || null,
      vehicle_photo_back_url: formData.vehicle_photo_back_url || null,
      vehicle_photo_side_url: formData.vehicle_photo_side_url || null,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    // Update profile role to driver
    await supabase
      .from('profiles')
      .update({ role: 'driver' })
      .eq('id', user.id);

    // Redirect to pending approval page
    router.push('/onboarding/pending');
  };

  const steps = [
    { id: 'vehicle', label: 'Vehicle', icon: Car },
    { id: 'license', label: 'License', icon: FileText },
    { id: 'documents', label: 'Insurance', icon: Shield },
    { id: 'photos', label: 'Photos', icon: Camera },
    { id: 'review', label: 'Review', icon: CheckCircle },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === step);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Image
            src="/images/logo.png"
            alt="EPYC Courier Service"
            width={120}
            height={80}
            className="mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-900">Complete Your Driver Profile</h1>
          <p className="text-gray-500 mt-2">Just a few more steps to start earning</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((s, index) => (
            <div key={s.id} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  index <= currentStepIndex
                    ? 'bg-epyc-primary text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                <s.icon className="h-5 w-5" />
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-12 h-1 mx-1 ${
                    index < currentStepIndex ? 'bg-epyc-primary' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Vehicle Step */}
          {step === 'vehicle' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Vehicle Information</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Type
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(VEHICLE_CONFIG).slice(0, 5).map(([key, config]) => (
                    <label
                      key={key}
                      className={`flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                        formData.vehicle_type === key
                          ? 'border-epyc-primary bg-emerald-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="vehicle_type"
                        value={key}
                        checked={formData.vehicle_type === key}
                        onChange={handleChange}
                        className="sr-only"
                      />
                      <span className="text-2xl mb-1">{config.icon}</span>
                      <span className="text-sm font-medium">{config.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
                  <input
                    type="text"
                    name="vehicle_make"
                    value={formData.vehicle_make}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Toyota"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <input
                    type="text"
                    name="vehicle_model"
                    value={formData.vehicle_model}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Camry"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <input
                    type="number"
                    name="vehicle_year"
                    value={formData.vehicle_year}
                    onChange={handleChange}
                    min="2000"
                    max={new Date().getFullYear() + 1}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    License Plate
                  </label>
                  <input
                    type="text"
                    name="vehicle_plate"
                    value={formData.vehicle_plate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="ABC1234"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">VIN Number</label>
                <input
                  type="text"
                  name="vehicle_vin"
                  value={formData.vehicle_vin}
                  onChange={handleChange}
                  maxLength={17}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                  placeholder="1HGBH41JXMN109186"
                />
                <p className="text-xs text-gray-500 mt-1">17-character Vehicle Identification Number</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Length (ft)</label>
                  <input
                    type="number"
                    name="vehicle_length"
                    value={formData.vehicle_length}
                    onChange={handleChange}
                    step="0.1"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="15"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Width (ft)</label>
                  <input
                    type="number"
                    name="vehicle_width"
                    value={formData.vehicle_width}
                    onChange={handleChange}
                    step="0.1"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="6"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Height (ft)</label>
                  <input
                    type="number"
                    name="vehicle_height"
                    value={formData.vehicle_height}
                    onChange={handleChange}
                    step="0.1"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="7"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cargo Capacity (cu ft)</label>
                <input
                  type="number"
                  name="cargo_capacity"
                  value={formData.cargo_capacity}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="200"
                />
                <p className="text-xs text-gray-500 mt-1">Approximate cargo space in cubic feet</p>
              </div>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="has_temperature_control"
                  checked={formData.has_temperature_control}
                  onChange={handleChange}
                  className="h-4 w-4 text-epyc-primary focus:ring-epyc-primary border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">
                  My vehicle has temperature control (cooler/refrigeration)
                </span>
              </label>

              <button
                onClick={() => setStep('license')}
                className="w-full py-3 bg-epyc-primary text-white rounded-lg font-medium flex items-center justify-center"
              >
                Continue
                <ArrowRight className="h-5 w-5 ml-2" />
              </button>
            </div>
          )}

          {/* License Step */}
          {step === 'license' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Driver&apos;s License</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  License Number
                </label>
                <input
                  type="text"
                  name="license_number"
                  value={formData.license_number}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="D1234567"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <select
                    name="license_state"
                    value={formData.license_state}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="CA">California</option>
                    <option value="AZ">Arizona</option>
                    <option value="NV">Nevada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiration Date
                  </label>
                  <input
                    type="date"
                    name="license_expiry"
                    value={formData.license_expiry}
                    onChange={handleChange}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('vehicle')}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium flex items-center justify-center"
                >
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Back
                </button>
                <button
                  onClick={() => setStep('documents')}
                  className="flex-1 py-3 bg-epyc-primary text-white rounded-lg font-medium flex items-center justify-center"
                >
                  Continue
                  <ArrowRight className="h-5 w-5 ml-2" />
                </button>
              </div>
            </div>
          )}

          {/* Documents Step */}
          {step === 'documents' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Insurance Information</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Policy Number
                </label>
                <input
                  type="text"
                  name="insurance_policy"
                  value={formData.insurance_policy}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="POL-123456"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiration Date
                </label>
                <input
                  type="date"
                  name="insurance_expiry"
                  value={formData.insurance_expiry}
                  onChange={handleChange}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> You can upload photos of your documents later from your
                  profile. We&apos;ll verify them during the background check.
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('license')}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium flex items-center justify-center"
                >
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Back
                </button>
                <button
                  onClick={() => setStep('photos')}
                  className="flex-1 py-3 bg-epyc-primary text-white rounded-lg font-medium flex items-center justify-center"
                >
                  Continue
                  <ArrowRight className="h-5 w-5 ml-2" />
                </button>
              </div>
            </div>
          )}

          {/* Photos Step */}
          {step === 'photos' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Upload Documents & Photos</h2>
              <p className="text-sm text-gray-500">
                Clear photos help us verify your information faster
              </p>

              <div className="space-y-4">
                <h3 className="font-medium text-gray-800">Driver&apos;s License</h3>
                <div className="grid grid-cols-2 gap-4">
                  <DocumentUpload
                    label="License Front"
                    description="Front of your driver's license"
                    bucket="driver-documents"
                    path={`licenses`}
                    currentUrl={formData.license_front_url || null}
                    onUploadComplete={(url) => setFormData(prev => ({ ...prev, license_front_url: url }))}
                    icon="camera"
                  />
                  <DocumentUpload
                    label="License Back"
                    description="Back of your driver's license"
                    bucket="driver-documents"
                    path={`licenses`}
                    currentUrl={formData.license_back_url || null}
                    onUploadComplete={(url) => setFormData(prev => ({ ...prev, license_back_url: url }))}
                    icon="camera"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium text-gray-800">Insurance & Registration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <DocumentUpload
                    label="Insurance Card"
                    description="Your auto insurance card"
                    bucket="driver-documents"
                    path={`insurance`}
                    currentUrl={formData.insurance_card_url || null}
                    onUploadComplete={(url) => setFormData(prev => ({ ...prev, insurance_card_url: url }))}
                    icon="file"
                    accept="image/*,.pdf"
                  />
                  <DocumentUpload
                    label="Registration"
                    description="Vehicle registration document"
                    bucket="driver-documents"
                    path={`registration`}
                    currentUrl={formData.registration_url || null}
                    onUploadComplete={(url) => setFormData(prev => ({ ...prev, registration_url: url }))}
                    icon="file"
                    accept="image/*,.pdf"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium text-gray-800">Vehicle Photos</h3>
                <p className="text-xs text-gray-500">
                  Clear photos of your vehicle from different angles
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <DocumentUpload
                    label="Front"
                    description="Front view"
                    bucket="driver-documents"
                    path={`vehicles`}
                    currentUrl={formData.vehicle_photo_front_url || null}
                    onUploadComplete={(url) => setFormData(prev => ({ ...prev, vehicle_photo_front_url: url }))}
                    icon="image"
                  />
                  <DocumentUpload
                    label="Back"
                    description="Rear view"
                    bucket="driver-documents"
                    path={`vehicles`}
                    currentUrl={formData.vehicle_photo_back_url || null}
                    onUploadComplete={(url) => setFormData(prev => ({ ...prev, vehicle_photo_back_url: url }))}
                    icon="image"
                  />
                  <DocumentUpload
                    label="Side"
                    description="Side view"
                    bucket="driver-documents"
                    path={`vehicles`}
                    currentUrl={formData.vehicle_photo_side_url || null}
                    onUploadComplete={(url) => setFormData(prev => ({ ...prev, vehicle_photo_side_url: url }))}
                    icon="image"
                  />
                </div>
              </div>

              <div className="bg-amber-50 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  <strong>Tip:</strong> You can skip uploading photos now and add them later from your profile,
                  but uploading them now speeds up approval.
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('documents')}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium flex items-center justify-center"
                >
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Back
                </button>
                <button
                  onClick={() => setStep('review')}
                  className="flex-1 py-3 bg-epyc-primary text-white rounded-lg font-medium flex items-center justify-center"
                >
                  Review
                  <ArrowRight className="h-5 w-5 ml-2" />
                </button>
              </div>
            </div>
          )}

          {/* Review Step */}
          {step === 'review' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Review Your Information</h2>

              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Vehicle</h3>
                  <p className="text-sm text-gray-600">
                    {formData.vehicle_year} {formData.vehicle_make} {formData.vehicle_model} (
                    {VEHICLE_CONFIG[formData.vehicle_type].label})
                  </p>
                  <p className="text-sm text-gray-600">Plate: {formData.vehicle_plate}</p>
                  {formData.vehicle_vin && (
                    <p className="text-sm text-gray-600">VIN: {formData.vehicle_vin}</p>
                  )}
                  {(formData.vehicle_length || formData.vehicle_width || formData.vehicle_height) && (
                    <p className="text-sm text-gray-600">
                      Dimensions: {formData.vehicle_length || '-'} x {formData.vehicle_width || '-'} x {formData.vehicle_height || '-'} ft
                    </p>
                  )}
                  {formData.cargo_capacity && (
                    <p className="text-sm text-gray-600">Cargo Capacity: {formData.cargo_capacity} cu ft</p>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">License</h3>
                  <p className="text-sm text-gray-600">
                    {formData.license_number} ({formData.license_state})
                  </p>
                  <p className="text-sm text-gray-600">
                    Expires: {formData.license_expiry}
                  </p>
                </div>

                {formData.insurance_policy && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">Insurance</h3>
                    <p className="text-sm text-gray-600">{formData.insurance_policy}</p>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Documents Uploaded</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center">
                      {formData.license_front_url ? (
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      ) : (
                        <div className="h-4 w-4 border border-gray-300 rounded-full mr-2" />
                      )}
                      <span className={formData.license_front_url ? 'text-gray-700' : 'text-gray-400'}>
                        License Front
                      </span>
                    </div>
                    <div className="flex items-center">
                      {formData.license_back_url ? (
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      ) : (
                        <div className="h-4 w-4 border border-gray-300 rounded-full mr-2" />
                      )}
                      <span className={formData.license_back_url ? 'text-gray-700' : 'text-gray-400'}>
                        License Back
                      </span>
                    </div>
                    <div className="flex items-center">
                      {formData.insurance_card_url ? (
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      ) : (
                        <div className="h-4 w-4 border border-gray-300 rounded-full mr-2" />
                      )}
                      <span className={formData.insurance_card_url ? 'text-gray-700' : 'text-gray-400'}>
                        Insurance Card
                      </span>
                    </div>
                    <div className="flex items-center">
                      {formData.registration_url ? (
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      ) : (
                        <div className="h-4 w-4 border border-gray-300 rounded-full mr-2" />
                      )}
                      <span className={formData.registration_url ? 'text-gray-700' : 'text-gray-400'}>
                        Registration
                      </span>
                    </div>
                    <div className="flex items-center">
                      {formData.vehicle_photo_front_url ? (
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      ) : (
                        <div className="h-4 w-4 border border-gray-300 rounded-full mr-2" />
                      )}
                      <span className={formData.vehicle_photo_front_url ? 'text-gray-700' : 'text-gray-400'}>
                        Vehicle Front
                      </span>
                    </div>
                    <div className="flex items-center">
                      {formData.vehicle_photo_back_url ? (
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      ) : (
                        <div className="h-4 w-4 border border-gray-300 rounded-full mr-2" />
                      )}
                      <span className={formData.vehicle_photo_back_url ? 'text-gray-700' : 'text-gray-400'}>
                        Vehicle Back
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      Free Background Check
                    </p>
                    <p className="text-sm text-green-700">
                      Unlike other platforms, we cover the cost. You&apos;ll be ready to drive once
                      approved (typically 1-3 business days).
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('photos')}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium flex items-center justify-center"
                >
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 py-3 bg-epyc-primary text-white rounded-lg font-medium flex items-center justify-center disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      Submit Application
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
