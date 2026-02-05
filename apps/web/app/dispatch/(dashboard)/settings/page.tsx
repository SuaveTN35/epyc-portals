'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Settings,
  User,
  Bell,
  Shield,
  DollarSign,
  Map,
  Clock,
  Truck,
  Save,
  Loader2,
  CheckCircle,
  Link2,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react';

interface BrokerConfig {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  auto_accept: boolean;
  callback_url: string;
  created_at: string;
}

interface DispatchSettings {
  autoAssignment: boolean;
  maxAssignmentRadius: number;
  defaultServiceLevel: string;
  rushSurchargePercent: number;
  expressSurchargePercent: number;
  driverPayoutPercent: number;
  requireSignatureDefault: boolean;
  notifyOnNewDelivery: boolean;
  notifyOnDriverOffline: boolean;
  notifyOnSupportTicket: boolean;
}

interface UserProfile {
  full_name: string;
  email: string;
  phone: string;
  role: string;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState<UserProfile>({
    full_name: '',
    email: '',
    phone: '',
    role: 'dispatcher',
  });
  const [brokers, setBrokers] = useState<BrokerConfig[]>([]);
  const [loadingBrokers, setLoadingBrokers] = useState(false);
  const [settings, setSettings] = useState<DispatchSettings>({
    autoAssignment: false,
    maxAssignmentRadius: 15,
    defaultServiceLevel: 'standard',
    rushSurchargePercent: 100,
    expressSurchargePercent: 50,
    driverPayoutPercent: 75,
    requireSignatureDefault: false,
    notifyOnNewDelivery: true,
    notifyOnDriverOffline: true,
    notifyOnSupportTicket: true,
  });

  useEffect(() => {
    fetchSettings();
    fetchBrokers();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, email, phone, role')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile({
          full_name: profileData.full_name || '',
          email: user.email || '',
          phone: profileData.phone || '',
          role: profileData.role || 'dispatcher',
        });
      }
    }

    setLoading(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          phone: profile.phone,
        })
        .eq('id', user.id);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const fetchBrokers = async () => {
    setLoadingBrokers(true);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (profile?.company_id) {
        const { data } = await supabase
          .from('brokers')
          .select('id, name, type, is_active, auto_accept, callback_url, created_at')
          .eq('company_id', profile.company_id)
          .order('created_at', { ascending: false });

        if (data) {
          setBrokers(data);
        }
      }
    }
    setLoadingBrokers(false);
  };

  const handleToggleBroker = async (brokerId: string, isActive: boolean) => {
    const supabase = createClient();
    await supabase
      .from('brokers')
      .update({ is_active: !isActive })
      .eq('id', brokerId);

    setBrokers(brokers.map((b) =>
      b.id === brokerId ? { ...b, is_active: !isActive } : b
    ));
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'dispatch', label: 'Dispatch', icon: Truck },
    { id: 'pricing', label: 'Pricing', icon: DollarSign },
    { id: 'brokers', label: 'Brokers', icon: Link2 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-epyc-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">
          Manage your account and dispatch preferences
        </p>
      </div>

      {/* Success message */}
      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-green-800">Settings saved successfully</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-epyc-primary text-epyc-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        <div className="p-6">
          {/* Profile tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profile.full_name}
                      onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={profile.email}
                      disabled
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role
                    </label>
                    <input
                      type="text"
                      value={profile.role}
                      disabled
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 capitalize"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="inline-flex items-center px-6 py-2 bg-epyc-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Profile
                </button>
              </div>
            </div>
          )}

          {/* Notifications tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Preferences</h3>
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                    <div>
                      <p className="font-medium text-gray-900">New Delivery Orders</p>
                      <p className="text-sm text-gray-500">
                        Get notified when new delivery orders are placed
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifyOnNewDelivery}
                      onChange={(e) =>
                        setSettings({ ...settings, notifyOnNewDelivery: e.target.checked })
                      }
                      className="h-5 w-5 text-epyc-primary rounded focus:ring-epyc-primary"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                    <div>
                      <p className="font-medium text-gray-900">Driver Goes Offline</p>
                      <p className="text-sm text-gray-500">
                        Alert when an active driver goes offline unexpectedly
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifyOnDriverOffline}
                      onChange={(e) =>
                        setSettings({ ...settings, notifyOnDriverOffline: e.target.checked })
                      }
                      className="h-5 w-5 text-epyc-primary rounded focus:ring-epyc-primary"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                    <div>
                      <p className="font-medium text-gray-900">New Support Tickets</p>
                      <p className="text-sm text-gray-500">
                        Get notified when new support tickets are opened
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifyOnSupportTicket}
                      onChange={(e) =>
                        setSettings({ ...settings, notifyOnSupportTicket: e.target.checked })
                      }
                      className="h-5 w-5 text-epyc-primary rounded focus:ring-epyc-primary"
                    />
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="inline-flex items-center px-6 py-2 bg-epyc-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Preferences
                </button>
              </div>
            </div>
          )}

          {/* Dispatch tab */}
          {activeTab === 'dispatch' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Dispatch Settings</h3>
                <div className="space-y-6">
                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Auto-Assignment</p>
                      <p className="text-sm text-gray-500">
                        Automatically assign deliveries to nearest available drivers
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoAssignment}
                      onChange={(e) =>
                        setSettings({ ...settings, autoAssignment: e.target.checked })
                      }
                      className="h-5 w-5 text-epyc-primary rounded focus:ring-epyc-primary"
                    />
                  </label>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maximum Assignment Radius (miles)
                    </label>
                    <input
                      type="number"
                      value={settings.maxAssignmentRadius}
                      onChange={(e) =>
                        setSettings({ ...settings, maxAssignmentRadius: Number(e.target.value) })
                      }
                      min={1}
                      max={50}
                      className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Drivers beyond this radius won't receive job offers
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Service Level
                    </label>
                    <select
                      value={settings.defaultServiceLevel}
                      onChange={(e) =>
                        setSettings({ ...settings, defaultServiceLevel: e.target.value })
                      }
                      className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary"
                    >
                      <option value="standard">Standard (4-6 hours)</option>
                      <option value="express">Express (2-4 hours)</option>
                      <option value="rush">Rush (Under 2 hours)</option>
                      <option value="same_day">Same Day</option>
                    </select>
                  </div>

                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Require Signature by Default</p>
                      <p className="text-sm text-gray-500">
                        Require signature on all deliveries unless specified otherwise
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.requireSignatureDefault}
                      onChange={(e) =>
                        setSettings({ ...settings, requireSignatureDefault: e.target.checked })
                      }
                      className="h-5 w-5 text-epyc-primary rounded focus:ring-epyc-primary"
                    />
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="inline-flex items-center px-6 py-2 bg-epyc-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Settings
                </button>
              </div>
            </div>
          )}

          {/* Pricing tab */}
          {activeTab === 'pricing' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Pricing Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rush Surcharge (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.rushSurchargePercent}
                        onChange={(e) =>
                          setSettings({ ...settings, rushSurchargePercent: Number(e.target.value) })
                        }
                        min={0}
                        max={200}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Additional charge for rush deliveries (under 2 hours)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Express Surcharge (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.expressSurchargePercent}
                        onChange={(e) =>
                          setSettings({ ...settings, expressSurchargePercent: Number(e.target.value) })
                        }
                        min={0}
                        max={200}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Additional charge for express deliveries (2-4 hours)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Driver Payout (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.driverPayoutPercent}
                        onChange={(e) =>
                          setSettings({ ...settings, driverPayoutPercent: Number(e.target.value) })
                        }
                        min={50}
                        max={100}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-epyc-primary focus:border-epyc-primary"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Percentage of delivery fee paid to drivers
                    </p>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Current Pricing Structure</h4>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p>Base Rate: $8.50 + $1.25/mile</p>
                    <p>Express: +{settings.expressSurchargePercent}% surcharge</p>
                    <p>Rush: +{settings.rushSurchargePercent}% surcharge</p>
                    <p>Driver receives {settings.driverPayoutPercent}% of delivery fee</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="inline-flex items-center px-6 py-2 bg-epyc-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Pricing
                </button>
              </div>
            </div>
          )}

          {/* Brokers tab */}
          {activeTab === 'brokers' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Broker Integrations</h3>
                    <p className="text-sm text-gray-500">
                      Manage connections with medical courier networks, logistics platforms, and B2B clients
                    </p>
                  </div>
                </div>

                {loadingBrokers ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-epyc-primary" />
                  </div>
                ) : brokers.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <Link2 className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-600 font-medium">No broker integrations</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Broker connections are configured via the API or database.
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      Brokers POST delivery jobs to <code className="bg-gray-100 px-1.5 py-0.5 rounded">/api/broker/deliveries</code>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {brokers.map((broker) => (
                      <div
                        key={broker.id}
                        className={`p-4 rounded-lg border ${
                          broker.is_active
                            ? 'bg-white border-gray-200'
                            : 'bg-gray-50 border-gray-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              broker.type === 'medical'
                                ? 'bg-red-100 text-red-600'
                                : broker.type === 'logistics'
                                ? 'bg-blue-100 text-blue-600'
                                : 'bg-green-100 text-green-600'
                            }`}>
                              <Link2 className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{broker.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                                  broker.type === 'medical'
                                    ? 'bg-red-100 text-red-700'
                                    : broker.type === 'logistics'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  {broker.type.replace('_', ' ').toUpperCase()}
                                </span>
                                {broker.auto_accept && (
                                  <span className="px-2 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 rounded-full">
                                    Auto-Accept
                                  </span>
                                )}
                                {broker.callback_url && (
                                  <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded-full">
                                    Callbacks
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-medium ${
                              broker.is_active ? 'text-green-600' : 'text-gray-400'
                            }`}>
                              {broker.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <button
                              onClick={() => handleToggleBroker(broker.id, broker.is_active)}
                              className="text-gray-400 hover:text-gray-600"
                              title={broker.is_active ? 'Deactivate broker' : 'Activate broker'}
                            >
                              {broker.is_active ? (
                                <ToggleRight className="h-6 w-6 text-green-500" />
                              ) : (
                                <ToggleLeft className="h-6 w-6" />
                              )}
                            </button>
                          </div>
                        </div>

                        {broker.callback_url && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <p className="text-xs text-gray-500">
                              Callback URL: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{broker.callback_url}</code>
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Broker API Endpoint</h4>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p>POST <code className="bg-blue-100 px-1.5 py-0.5 rounded">/api/broker/deliveries</code> - Submit new delivery</p>
                    <p>GET <code className="bg-blue-100 px-1.5 py-0.5 rounded">/api/broker/deliveries/:id</code> - Check delivery status</p>
                    <p>POST <code className="bg-blue-100 px-1.5 py-0.5 rounded">/api/broker/deliveries/:id/cancel</code> - Cancel delivery</p>
                    <p className="mt-2 text-xs text-blue-600">Authentication: Bearer token via API key</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
