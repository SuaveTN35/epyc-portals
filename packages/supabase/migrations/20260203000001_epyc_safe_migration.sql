-- EPYC Courier Service Database Schema
-- Safe Migration - handles existing tables
-- Date: 2026-02-03

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "cube";
CREATE EXTENSION IF NOT EXISTS "earthdistance";

-- ============================================
-- ADD COLUMNS TO EXISTING PROFILES TABLE
-- ============================================
DO $$
BEGIN
  -- Add role column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
    ALTER TABLE profiles ADD COLUMN role TEXT CHECK (role IN ('customer', 'driver', 'dispatcher', 'admin')) DEFAULT 'customer';
  END IF;

  -- Add company_name if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'company_name') THEN
    ALTER TABLE profiles ADD COLUMN company_name TEXT;
  END IF;

  -- Add stripe_customer_id if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'stripe_customer_id') THEN
    ALTER TABLE profiles ADD COLUMN stripe_customer_id TEXT;
  END IF;

  -- Add stripe_connect_id if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'stripe_connect_id') THEN
    ALTER TABLE profiles ADD COLUMN stripe_connect_id TEXT;
  END IF;
END $$;

-- ============================================
-- COMPANIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  phone TEXT,
  email TEXT,
  billing_email TEXT,
  hipaa_compliant BOOLEAN DEFAULT false,
  api_key TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DRIVERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  license_number TEXT NOT NULL,
  license_state TEXT NOT NULL,
  license_expiry DATE NOT NULL,
  vehicle_type TEXT CHECK (vehicle_type IN ('car', 'suv', 'van', 'truck', 'box_truck')) NOT NULL,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  vehicle_plate TEXT,
  insurance_policy TEXT,
  insurance_expiry DATE,
  background_check_status TEXT CHECK (background_check_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  background_check_date DATE,
  hipaa_certified BOOLEAN DEFAULT false,
  hipaa_cert_expiry DATE,
  max_weight_capacity INTEGER DEFAULT 50,
  has_temperature_control BOOLEAN DEFAULT false,
  current_lat DECIMAL(10, 8),
  current_lng DECIMAL(11, 8),
  is_online BOOLEAN DEFAULT false,
  rating DECIMAL(3, 2) DEFAULT 5.00,
  total_deliveries INTEGER DEFAULT 0,
  loyalty_tier TEXT CHECK (loyalty_tier IN ('bronze', 'silver', 'gold', 'platinum')) DEFAULT 'bronze',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id)
);

-- ============================================
-- DELIVERIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES profiles(id) NOT NULL,
  company_id UUID REFERENCES companies(id),
  driver_id UUID REFERENCES drivers(id),
  status TEXT CHECK (status IN (
    'quote_requested', 'quoted', 'booked', 'assigned',
    'en_route_pickup', 'arrived_pickup', 'picked_up',
    'en_route_delivery', 'arrived_delivery', 'delivered',
    'cancelled', 'failed'
  )) DEFAULT 'quote_requested',
  pickup_address TEXT NOT NULL,
  pickup_city TEXT NOT NULL,
  pickup_state TEXT NOT NULL,
  pickup_zip TEXT NOT NULL,
  pickup_lat DECIMAL(10, 8),
  pickup_lng DECIMAL(11, 8),
  pickup_contact_name TEXT,
  pickup_contact_phone TEXT,
  pickup_instructions TEXT,
  pickup_window_start TIMESTAMPTZ,
  pickup_window_end TIMESTAMPTZ,
  actual_pickup_time TIMESTAMPTZ,
  delivery_address TEXT NOT NULL,
  delivery_city TEXT NOT NULL,
  delivery_state TEXT NOT NULL,
  delivery_zip TEXT NOT NULL,
  delivery_lat DECIMAL(10, 8),
  delivery_lng DECIMAL(11, 8),
  delivery_contact_name TEXT,
  delivery_contact_phone TEXT,
  delivery_instructions TEXT,
  delivery_window_start TIMESTAMPTZ,
  delivery_window_end TIMESTAMPTZ,
  actual_delivery_time TIMESTAMPTZ,
  package_description TEXT,
  package_weight DECIMAL(10, 2),
  package_length DECIMAL(10, 2),
  package_width DECIMAL(10, 2),
  package_height DECIMAL(10, 2),
  requires_signature BOOLEAN DEFAULT true,
  requires_photo_pod BOOLEAN DEFAULT true,
  is_fragile BOOLEAN DEFAULT false,
  is_medical BOOLEAN DEFAULT false,
  is_hipaa BOOLEAN DEFAULT false,
  requires_temperature_control BOOLEAN DEFAULT false,
  temperature_min DECIMAL(5, 2),
  temperature_max DECIMAL(5, 2),
  distance_miles DECIMAL(10, 2),
  estimated_duration_minutes INTEGER,
  base_price DECIMAL(10, 2),
  distance_price DECIMAL(10, 2),
  weight_surcharge DECIMAL(10, 2) DEFAULT 0,
  rush_surcharge DECIMAL(10, 2) DEFAULT 0,
  hipaa_surcharge DECIMAL(10, 2) DEFAULT 0,
  temperature_surcharge DECIMAL(10, 2) DEFAULT 0,
  total_price DECIMAL(10, 2),
  driver_payout DECIMAL(10, 2),
  tip_amount DECIMAL(10, 2) DEFAULT 0,
  service_level TEXT CHECK (service_level IN ('standard', 'priority', 'rush', 'scheduled')) DEFAULT 'standard',
  vehicle_required TEXT CHECK (vehicle_required IN ('car', 'suv', 'van', 'truck', 'box_truck')),
  quoted_at TIMESTAMPTZ,
  booked_at TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DELIVERY EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS delivery_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  ip_address INET,
  user_agent TEXT,
  access_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROOF OF DELIVERY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS proof_of_delivery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('signature', 'photo', 'barcode', 'otp', 'temperature')) NOT NULL,
  signature_data TEXT,
  photo_url TEXT,
  barcode_value TEXT,
  otp_code TEXT,
  temperature_reading DECIMAL(5, 2),
  recipient_name TEXT,
  recipient_relation TEXT,
  notes TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  captured_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TEMPERATURE LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS temperature_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES drivers(id),
  temperature DECIMAL(5, 2) NOT NULL,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DRIVER LOCATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS driver_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE NOT NULL,
  delivery_id UUID REFERENCES deliveries(id),
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  speed DECIMAL(5, 2),
  heading INTEGER,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES profiles(id) NOT NULL,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  tip_amount DECIMAL(10, 2) DEFAULT 0,
  status TEXT CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded')) DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DRIVER PAYOUTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS driver_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE NOT NULL,
  delivery_id UUID REFERENCES deliveries(id),
  stripe_transfer_id TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  tip_amount DECIMAL(10, 2) DEFAULT 0,
  status TEXT CHECK (status IN ('pending', 'processing', 'paid', 'failed')) DEFAULT 'pending',
  payout_method TEXT CHECK (payout_method IN ('instant', 'standard')) DEFAULT 'standard',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RATINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE NOT NULL,
  rated_by UUID REFERENCES profiles(id) NOT NULL,
  rated_user UUID REFERENCES profiles(id),
  rated_driver UUID REFERENCES drivers(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUPPORT TICKETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID REFERENCES deliveries(id),
  created_by UUID REFERENCES profiles(id) NOT NULL,
  assigned_to UUID REFERENCES profiles(id),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')) DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  delivery_id UUID REFERENCES deliveries(id),
  type TEXT CHECK (type IN ('sms', 'email', 'push')) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- JOB OFFERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS job_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')) DEFAULT 'pending',
  estimated_payout DECIMAL(10, 2),
  distance_to_pickup_miles DECIMAL(10, 2),
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- API KEYS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  key_hash TEXT NOT NULL,
  name TEXT,
  permissions TEXT[],
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES (only create if not exists)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_drivers_profile ON drivers(profile_id);
CREATE INDEX IF NOT EXISTS idx_drivers_online ON drivers(is_online) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_drivers_vehicle ON drivers(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_deliveries_tracking ON deliveries(tracking_number);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_customer ON deliveries(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver ON deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_events_delivery ON delivery_events(delivery_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver ON driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_temperature_logs_delivery ON temperature_logs(delivery_id);
CREATE INDEX IF NOT EXISTS idx_payments_delivery ON payments(delivery_id);
CREATE INDEX IF NOT EXISTS idx_driver_payouts_driver ON driver_payouts(driver_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_delivery ON job_offers(delivery_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_driver ON job_offers(driver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE proof_of_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE temperature_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Drivers policies
DROP POLICY IF EXISTS "Drivers can view own driver record" ON drivers;
CREATE POLICY "Drivers can view own driver record" ON drivers
  FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Drivers can update own driver record" ON drivers;
CREATE POLICY "Drivers can update own driver record" ON drivers
  FOR UPDATE USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Drivers can insert own driver record" ON drivers;
CREATE POLICY "Drivers can insert own driver record" ON drivers
  FOR INSERT WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Dispatchers can view all drivers" ON drivers;
CREATE POLICY "Dispatchers can view all drivers" ON drivers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher'))
  );

DROP POLICY IF EXISTS "Dispatchers can update all drivers" ON drivers;
CREATE POLICY "Dispatchers can update all drivers" ON drivers
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher'))
  );

-- Deliveries policies
DROP POLICY IF EXISTS "Customers view own deliveries" ON deliveries;
CREATE POLICY "Customers view own deliveries" ON deliveries
  FOR SELECT USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Drivers view assigned deliveries" ON deliveries;
CREATE POLICY "Drivers view assigned deliveries" ON deliveries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM drivers WHERE profile_id = auth.uid() AND id = driver_id)
  );

DROP POLICY IF EXISTS "Dispatchers view all deliveries" ON deliveries;
CREATE POLICY "Dispatchers view all deliveries" ON deliveries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher'))
  );

DROP POLICY IF EXISTS "Customers can create deliveries" ON deliveries;
CREATE POLICY "Customers can create deliveries" ON deliveries
  FOR INSERT WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Drivers can update assigned deliveries" ON deliveries;
CREATE POLICY "Drivers can update assigned deliveries" ON deliveries
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM drivers WHERE profile_id = auth.uid() AND id = driver_id)
  );

DROP POLICY IF EXISTS "Dispatchers can update all deliveries" ON deliveries;
CREATE POLICY "Dispatchers can update all deliveries" ON deliveries
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher'))
  );

-- Job Offers policies
DROP POLICY IF EXISTS "Drivers view own job offers" ON job_offers;
CREATE POLICY "Drivers view own job offers" ON job_offers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM drivers WHERE profile_id = auth.uid() AND id = driver_id)
  );

DROP POLICY IF EXISTS "Drivers can update own job offers" ON job_offers;
CREATE POLICY "Drivers can update own job offers" ON job_offers
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM drivers WHERE profile_id = auth.uid() AND id = driver_id)
  );

-- Notifications policies
DROP POLICY IF EXISTS "Users view own notifications" ON notifications;
CREATE POLICY "Users view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Driver Payouts policies
DROP POLICY IF EXISTS "Drivers view own payouts" ON driver_payouts;
CREATE POLICY "Drivers view own payouts" ON driver_payouts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM drivers WHERE profile_id = auth.uid() AND id = driver_id)
  );

-- Payments policies
DROP POLICY IF EXISTS "Customers view own payments" ON payments;
CREATE POLICY "Customers view own payments" ON payments
  FOR SELECT USING (customer_id = auth.uid());

-- Support Tickets policies
DROP POLICY IF EXISTS "Users view own tickets" ON support_tickets;
CREATE POLICY "Users view own tickets" ON support_tickets
  FOR SELECT USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Dispatchers view all tickets" ON support_tickets;
CREATE POLICY "Dispatchers view all tickets" ON support_tickets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher'))
  );

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_drivers_updated_at ON drivers;
CREATE TRIGGER update_drivers_updated_at
  BEFORE UPDATE ON drivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deliveries_updated_at ON deliveries;
CREATE TRIGGER update_deliveries_updated_at
  BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to log delivery status changes
CREATE OR REPLACE FUNCTION log_delivery_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO delivery_events (delivery_id, event_type, old_status, new_status, created_by)
    VALUES (NEW.id, 'status_change', OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_delivery_status_change ON deliveries;
CREATE TRIGGER on_delivery_status_change
  AFTER UPDATE OF status ON deliveries
  FOR EACH ROW EXECUTE FUNCTION log_delivery_status_change();

-- Function to update driver stats after delivery
CREATE OR REPLACE FUNCTION update_driver_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    UPDATE drivers
    SET total_deliveries = total_deliveries + 1,
        loyalty_tier = CASE
          WHEN total_deliveries + 1 >= 500 THEN 'platinum'
          WHEN total_deliveries + 1 >= 200 THEN 'gold'
          WHEN total_deliveries + 1 >= 50 THEN 'silver'
          ELSE 'bronze'
        END
    WHERE id = NEW.driver_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_delivery_completed ON deliveries;
CREATE TRIGGER on_delivery_completed
  AFTER UPDATE OF status ON deliveries
  FOR EACH ROW EXECUTE FUNCTION update_driver_stats();

-- Done!
SELECT 'EPYC Courier schema migration completed successfully!' as result;
