'use client';

import { useState } from 'react';
import { SMS_CONSENT_TEXT } from '@/lib/sms';
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
import { ProfileItemRow } from '@/components/driver/ProfileItemRow';
import { uploadProfileItemPhoto } from '@/lib/upload-client';
import { PROFILE_ITEMS, type ProfileItemDef, type ProfileItemId } from '@/lib/driver-profile-items';
import {
  DIMENSION_BOUNDS,
  onboardingMissing,
  pacificToday,
  validateDimensions,
  validateInsuranceDetails,
  validateRegistrationExpiry,
} from '@/lib/driver-profile';

const PHOTO_ITEMS = (PROFILE_ITEMS as readonly ProfileItemDef[]).filter((d) => d.kind === 'photo');

type Step = 'vehicle' | 'license' | 'documents' | 'photos' | 'review';

export default function DriverOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('vehicle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // P-366 checklist photos: storage path and a local preview per item.
  const [itemPaths, setItemPaths] = useState<Partial<Record<ProfileItemId, string>>>({});
  const [itemPreviews, setItemPreviews] = useState<Partial<Record<ProfileItemId, string>>>({});

  const [formData, setFormData] = useState({
    // Vehicle
    vehicle_type: 'car' as VehicleType,
    vehicle_make: '',
    vehicle_model: '',
    vehicle_year: new Date().getFullYear(),
    vehicle_plate: '',
    vehicle_vin: '',
    // Cargo space in inches and max load in pounds (P-366).
    cargo_length_in: '',
    cargo_width_in: '',
    cargo_height_in: '',
    cargo_capacity_lbs: '',
    has_temperature_control: false,
    // License
    license_number: '',
    license_state: 'CA',
    license_expiry: '',
    // Insurance
    insurance_policy: '',
    insurance_expiry: '',
    insurance_carrier: '',
    insurance_bi_per_person: '',
    insurance_bi_per_accident: '',
    insurance_pd_limit: '',
    insurance_business_use: null as boolean | null,
    registration_expiry: '',
    // License photos (insurance, registration, and vehicle photos are in itemPaths)
    license_front_url: '',
    license_back_url: '',
    // SMS consent (unticked by default; never pre-checked)
    sms_opt_in: false,
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

  const today = pacificToday();

  const goNext = (next: Step) => {
    setError(null);
    if (step === 'vehicle') {
      const v = validateDimensions(formData);
      if (!v.ok) return setError(v.error);
    }
    if (step === 'documents') {
      const ins = validateInsuranceDetails(formData, today);
      if (!ins.ok) return setError(ins.error);
      const reg = validateRegistrationExpiry(formData, today);
      if (!reg.ok) return setError(reg.error);
    }
    if (step === 'photos') {
      const missing = onboardingMissing(
        Object.fromEntries(PHOTO_ITEMS.map((d) => [d.id, !!itemPaths[d.id as ProfileItemId]]).concat([['cargo_dimensions', true]]))
      );
      if (missing.length > 0) {
        return setError(`Still needed: ${missing.map((d) => d.label).join(', ')}`);
      }
    }
    setStep(next);
  };

  const uploadItem = (def: ProfileItemDef) => async (file: File) => {
    const { path, file: sent } = await uploadProfileItemPhoto(file, def.id, {
      allowPdf: !!def.allowPdf,
      record: false,
    });
    setItemPaths((prev) => ({ ...prev, [def.id]: path }));
    setItemPreviews((prev) => {
      const old = prev[def.id as ProfileItemId];
      if (old) URL.revokeObjectURL(old);
      return { ...prev, [def.id]: URL.createObjectURL(sent) };
    });
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

    // Re-check everything required before writing (P-366).
    const dims = validateDimensions(formData);
    const ins = validateInsuranceDetails(formData, today);
    const reg = validateRegistrationExpiry(formData, today);
    const missingItems = onboardingMissing(
      Object.fromEntries(PHOTO_ITEMS.map((d) => [d.id, !!itemPaths[d.id as ProfileItemId]]).concat([['cargo_dimensions', true]]))
    );
    if (!dims.ok || !ins.ok || !reg.ok || missingItems.length > 0) {
      setError(
        !dims.ok ? dims.error : !ins.ok ? ins.error : !reg.ok ? reg.error : `Still needed: ${missingItems.map((d) => d.label).join(', ')}`
      );
      setLoading(false);
      return;
    }

    // Create driver record. The database queues every document, vehicle
    // photo, and the dimensions for dispatch review as 'pending'.
    const { data: created, error: insertError } = await supabase.from('drivers').insert({
      profile_id: user.id,
      vehicle_type: formData.vehicle_type,
      vehicle_make: formData.vehicle_make,
      vehicle_model: formData.vehicle_model,
      vehicle_year: formData.vehicle_year,
      vehicle_plate: formData.vehicle_plate,
      vehicle_vin: formData.vehicle_vin || null,
      ...dims.value,
      has_temperature_control: formData.has_temperature_control,
      license_number: formData.license_number,
      license_state: formData.license_state,
      license_expiry: formData.license_expiry,
      ...ins.value,
      ...reg.value,
      max_weight_capacity: maxWeightCapacity,
      background_check_status: 'pending',
      // Document URLs
      license_front_url: formData.license_front_url || null,
      license_back_url: formData.license_back_url || null,
      insurance_card_url: itemPaths.insurance_card ?? null,
      registration_url: itemPaths.registration ?? null,
      vehicle_photo_front_url: itemPaths.vehicle_front ?? null,
      vehicle_photo_back_url: itemPaths.vehicle_back ?? null,
      vehicle_photo_side_url: itemPaths.vehicle_side ?? null,
      vehicle_photo_cargo_url: itemPaths.vehicle_cargo ?? null,
    }).select('id').single();

    if (insertError || !created) {
      setError(insertError?.message || 'Could not save your application. Please try again.');
      setLoading(false);
      return;
    }

    // Equipment photos (required and extras) go to dispatch as 'pending'.
    const equipmentRows = PHOTO_ITEMS.filter((d) => d.group === 'equipment' && itemPaths[d.id as ProfileItemId]).map((d) => ({
      driver_id: created.id,
      item: d.id,
      photo_path: itemPaths[d.id as ProfileItemId]!,
    }));
    if (equipmentRows.length > 0) {
      const { error: equipmentError } = await supabase.from('driver_review_items').insert(equipmentRows);
      if (equipmentError) {
        // The application itself is saved; the profile page lets them re-add these.
        console.error('Equipment save failed:', equipmentError.code);
      }
    }

    // Update profile role to driver
    await supabase
      .from('profiles')
      .update({ role: 'driver' })
      .eq('id', user.id);

    // SMS consent, saved separately so a problem here never blocks the role change.
    if (formData.sms_opt_in) {
      await supabase.from('profiles').update({ sms_opt_in: true }).eq('id', user.id);
    }

    // Documents are complete; the application moves to background-check screening.
    await supabase
      .from('driver_applications')
      .update({ status: 'screening', updated_at: new Date().toISOString() })
      .eq('profile_id', user.id)
      .in('status', ['pending_review', 'contacted']);

    // Redirect to driver dashboard
    router.push('/driver/jobs');
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

              <div>
                <p className="block text-sm font-medium text-gray-700">Cargo space (inches)</p>
                <p className="text-xs text-gray-500 mb-2">Measure the space where the load goes: trunk, bed, or cargo box.</p>
                <div className="grid grid-cols-3 gap-3">
                  {(['cargo_length_in', 'cargo_width_in', 'cargo_height_in'] as const).map((k) => (
                    <div key={k}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {DIMENSION_BOUNDS[k].label.replace('Cargo ', '')} (in)
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        name={k}
                        value={formData[k]}
                        onChange={handleChange}
                        step="0.5"
                        min={DIMENSION_BOUNDS[k].min}
                        max={DIMENSION_BOUNDS[k].max}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max load (lbs)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  name="cargo_capacity_lbs"
                  value={formData.cargo_capacity_lbs}
                  onChange={handleChange}
                  min={DIMENSION_BOUNDS.cargo_capacity_lbs.min}
                  max={DIMENSION_BOUNDS.cargo_capacity_lbs.max}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="1000"
                />
                <p className="text-xs text-gray-500 mt-1">The most weight your vehicle can safely carry, in pounds</p>
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
                onClick={() => goNext('license')}
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
                  onClick={() => goNext('documents')}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Company</label>
                <input
                  type="text"
                  name="insurance_carrier"
                  value={formData.insurance_carrier}
                  onChange={handleChange}
                  maxLength={100}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Company name on your card"
                />
              </div>

              <div>
                <p className="block text-sm font-medium text-gray-700">Coverage Limits (dollars)</p>
                <p className="text-xs text-gray-500 mb-2">From your card or declarations page, for example 30,000 / 60,000 / 15,000.</p>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    ['insurance_bi_per_person', 'Injury per person'],
                    ['insurance_bi_per_accident', 'Injury per accident'],
                    ['insurance_pd_limit', 'Property damage'],
                  ] as const).map(([k, label]) => (
                    <div key={k}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{label} ($)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        name={k}
                        value={formData[k]}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <fieldset>
                <legend className="block text-sm font-medium text-gray-700 mb-2">
                  Does your policy cover delivery / business use?
                </legend>
                <div className="flex gap-3">
                  {[
                    { v: true, t: 'Yes' },
                    { v: false, t: 'No' },
                  ].map((o) => (
                    <button
                      key={o.t}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, insurance_business_use: o.v }))}
                      className={`flex-1 py-3 rounded-lg border text-sm font-medium ${
                        formData.insurance_business_use === o.v
                          ? 'border-epyc-primary bg-emerald-50 text-gray-900'
                          : 'border-gray-300 text-gray-700'
                      }`}
                    >
                      {o.t}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vehicle Registration Expiration Date
                </label>
                <input
                  type="date"
                  name="registration_expiry"
                  value={formData.registration_expiry}
                  onChange={handleChange}
                  min={today}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  You will photograph your insurance card and registration on the next step.
                  You cannot get job offers until dispatch approves a current insurance card.
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
                  onClick={() => goNext('photos')}
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

              {([
                ['Vehicle', 'vehicle', true],
                ['Insurance & Registration', 'documents', true],
                ['Equipment', 'equipment', true],
              ] as const).map(([title, group]) => (
                <div key={group} className="space-y-1">
                  <h3 className="font-medium text-gray-800">{title}</h3>
                  <ul className="divide-y divide-gray-100">
                    {PHOTO_ITEMS.filter((d) => d.group === group && d.required).map((d) => (
                      <ProfileItemRow
                        key={d.id}
                        def={d}
                        state={itemPaths[d.id as ProfileItemId] ? 'pending' : 'missing'}
                        thumbUrl={itemPreviews[d.id as ProfileItemId] ?? null}
                        isPdf={!!itemPaths[d.id as ProfileItemId]?.endsWith('.pdf')}
                        onFile={uploadItem(d)}
                      />
                    ))}
                  </ul>
                </div>
              ))}

              <div className="space-y-1">
                <h3 className="font-medium text-gray-800">Extras that get you more jobs</h3>
                <p className="text-xs text-gray-500">Optional. Add these if you have them; dispatch uses them to match jobs.</p>
                <ul className="divide-y divide-gray-100">
                  {PHOTO_ITEMS.filter((d) => !d.required).map((d) => (
                    <ProfileItemRow
                      key={d.id}
                      def={d}
                      state={itemPaths[d.id as ProfileItemId] ? 'pending' : 'missing'}
                      thumbUrl={itemPreviews[d.id as ProfileItemId] ?? null}
                      onFile={uploadItem(d)}
                    />
                  ))}
                </ul>
              </div>

              <div className="bg-amber-50 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  Items marked Required are needed to finish your application. Dispatch reviews each photo.
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
                  onClick={() => goNext('review')}
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
                  <p className="text-sm text-gray-600">
                    Cargo space: {formData.cargo_length_in || '-'} x {formData.cargo_width_in || '-'} x {formData.cargo_height_in || '-'} in (L x W x H)
                  </p>
                  <p className="text-sm text-gray-600">Max load: {formData.cargo_capacity_lbs || '-'} lbs</p>
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

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Insurance</h3>
                  <p className="text-sm text-gray-600">
                    {formData.insurance_carrier} - {formData.insurance_policy}
                  </p>
                  <p className="text-sm text-gray-600">Expires: {formData.insurance_expiry}</p>
                  <p className="text-sm text-gray-600">
                    Covers delivery / business use: {formData.insurance_business_use ? 'Yes' : 'No'}
                  </p>
                  <p className="text-sm text-gray-600">Registration expires: {formData.registration_expiry}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Photos Added</h3>
                  <ul className="grid grid-cols-1 gap-1 text-sm">
                    {[
                      { id: 'license_front', label: 'License front', done: !!formData.license_front_url, required: false },
                      { id: 'license_back', label: 'License back', done: !!formData.license_back_url, required: false },
                      ...PHOTO_ITEMS.map((d) => ({
                        id: d.id,
                        label: d.label,
                        done: !!itemPaths[d.id as ProfileItemId],
                        required: d.required,
                      })),
                    ].map((row) => (
                      <li key={row.id} className="flex items-center">
                        {row.done ? (
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                        ) : (
                          <div className="h-4 w-4 border border-gray-300 rounded-full mr-2" />
                        )}
                        <span className={row.done ? 'text-gray-700' : 'text-gray-400'}>
                          {row.label}
                          {!row.required && !row.id.startsWith('license') ? ' (extra)' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
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

              <label className="flex items-start gap-3 bg-gray-50 rounded-lg p-4 cursor-pointer">
                <input
                  type="checkbox"
                  name="sms_opt_in"
                  checked={formData.sms_opt_in}
                  onChange={handleChange}
                  className="mt-0.5 h-5 w-5 rounded border-gray-300 text-epyc-primary flex-shrink-0"
                />
                <span className="text-sm text-gray-700">{SMS_CONSENT_TEXT}</span>
              </label>

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
