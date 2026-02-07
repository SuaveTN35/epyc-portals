import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import {
  User,
  Car,
  Shield,
  Star,
  Award,
  FileText,
  Bell,
  HelpCircle,
  LogOut,
  ChevronRight,
  CheckCircle,
} from 'lucide-react';
import { VEHICLE_CONFIG, LOYALTY_TIER_CONFIG } from '@epyc/shared';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/driver/login');
  }

  // Get driver with profile
  const { data: driver } = await supabase
    .from('drivers')
    .select('*, profiles(*)')
    .eq('profile_id', user.id)
    .single();

  if (!driver) {
    redirect('/driver/onboarding');
  }

  const profile = driver.profiles;
  const vehicleConfig = VEHICLE_CONFIG[driver.vehicle_type as keyof typeof VEHICLE_CONFIG];
  const loyaltyConfig = LOYALTY_TIER_CONFIG[driver.loyalty_tier as keyof typeof LOYALTY_TIER_CONFIG];

  const loyaltyColors = {
    bronze: 'from-orange-400 to-orange-600',
    silver: 'from-gray-400 to-gray-600',
    gold: 'from-yellow-400 to-yellow-600',
    platinum: 'from-purple-400 to-purple-600',
  };

  return (
    <div className="pb-4">
      {/* Profile Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <div className="flex items-center">
          <div className="w-16 h-16 rounded-full bg-epyc-primary flex items-center justify-center text-white text-2xl font-bold">
            {profile?.full_name?.[0]?.toUpperCase() || 'D'}
          </div>
          <div className="ml-4 flex-1">
            <h2 className="text-xl font-bold text-gray-900">{profile?.full_name}</h2>
            <p className="text-gray-500">{profile?.email}</p>
          </div>
        </div>

        {/* Loyalty Badge */}
        <div className={`mt-4 bg-gradient-to-r ${loyaltyColors[driver.loyalty_tier as keyof typeof loyaltyColors]} rounded-lg p-4 text-white`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm">Driver Tier</p>
              <p className="text-xl font-bold capitalize">{driver.loyalty_tier}</p>
            </div>
            <Award className="h-10 w-10 text-white/80" />
          </div>
          <div className="mt-3 text-sm text-white/90">
            {loyaltyConfig.perks.slice(0, 2).join(' • ')}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <div className="flex items-center justify-center mb-1">
            <Star className="h-5 w-5 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{driver.rating?.toFixed(1)}</p>
          <p className="text-xs text-gray-500">Rating</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <div className="flex items-center justify-center mb-1">
            <CheckCircle className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{driver.total_deliveries}</p>
          <p className="text-xs text-gray-500">Deliveries</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <div className="flex items-center justify-center mb-1">
            <span className="text-xl">{vehicleConfig?.icon || '🚗'}</span>
          </div>
          <p className="text-sm font-bold text-gray-900">{vehicleConfig?.label || driver.vehicle_type}</p>
          <p className="text-xs text-gray-500">Vehicle</p>
        </div>
      </div>

      {/* Vehicle Info */}
      <div className="bg-white rounded-xl shadow-sm mb-4">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Vehicle Information</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-500">Type</span>
            <span className="text-gray-900">{vehicleConfig?.label}</span>
          </div>
          {driver.vehicle_make && (
            <div className="flex justify-between">
              <span className="text-gray-500">Make/Model</span>
              <span className="text-gray-900">
                {driver.vehicle_year} {driver.vehicle_make} {driver.vehicle_model}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Plate</span>
            <span className="text-gray-900">{driver.vehicle_plate || 'Not set'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Max Capacity</span>
            <span className="text-gray-900">{driver.max_weight_capacity} lbs</span>
          </div>
          {driver.has_temperature_control && (
            <div className="flex justify-between">
              <span className="text-gray-500">Temperature Control</span>
              <span className="text-green-600 flex items-center">
                <CheckCircle className="h-4 w-4 mr-1" />
                Equipped
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Certifications */}
      <div className="bg-white rounded-xl shadow-sm mb-4">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Certifications</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Shield className="h-5 w-5 text-blue-500 mr-3" />
              <span className="text-gray-700">Background Check</span>
            </div>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                driver.background_check_status === 'approved'
                  ? 'bg-green-100 text-green-700'
                  : driver.background_check_status === 'pending'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {driver.background_check_status}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Shield className="h-5 w-5 text-green-500 mr-3" />
              <span className="text-gray-700">HIPAA Certified</span>
            </div>
            {driver.hipaa_certified ? (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                Certified
              </span>
            ) : (
              <button className="text-sm text-epyc-primary font-medium">Get Certified</button>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FileText className="h-5 w-5 text-gray-400 mr-3" />
              <span className="text-gray-700">Driver&apos;s License</span>
            </div>
            <span className="text-sm text-gray-500">
              Exp: {new Date(driver.license_expiry).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FileText className="h-5 w-5 text-gray-400 mr-3" />
              <span className="text-gray-700">Insurance</span>
            </div>
            <span className="text-sm text-gray-500">
              {driver.insurance_expiry
                ? `Exp: ${new Date(driver.insurance_expiry).toLocaleDateString()}`
                : 'Not set'}
            </span>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="bg-white rounded-xl shadow-sm">
        <MenuItem icon={User} label="Edit Profile" href="mailto:admin@epyccs.com?subject=Profile%20Update%20Request" />
        <MenuItem icon={Car} label="Update Vehicle" href="mailto:admin@epyccs.com?subject=Vehicle%20Update%20Request" />
        <MenuItem icon={Bell} label="Notifications" href="/driver/jobs" />
        <MenuItem icon={HelpCircle} label="Help & Support" href="/contact" />
        <MenuItem icon={LogOut} label="Sign Out" href="/api/auth/signout" isDestructive />
      </div>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  href,
  isDestructive = false,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  isDestructive?: boolean;
}) {
  return (
    <a
      href={href}
      className="flex items-center justify-between px-4 py-4 border-b border-gray-100 last:border-0"
    >
      <div className="flex items-center">
        <Icon className={`h-5 w-5 mr-3 ${isDestructive ? 'text-red-500' : 'text-gray-400'}`} />
        <span className={isDestructive ? 'text-red-600' : 'text-gray-700'}>{label}</span>
      </div>
      <ChevronRight className="h-5 w-5 text-gray-300" />
    </a>
  );
}
