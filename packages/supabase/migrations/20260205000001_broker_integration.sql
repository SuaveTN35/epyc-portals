-- EPYC Courier Service - Broker Integration
-- Migration: Broker Integration Tables
-- Date: 2026-02-05

-- ============================================
-- BROKERS TABLE
-- ============================================
CREATE TABLE brokers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('medical', 'logistics', 'b2b_client')) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  auto_accept BOOLEAN DEFAULT false,
  auto_accept_max_distance_miles DECIMAL(10,2),
  auto_accept_service_levels TEXT[],
  callback_url TEXT,
  callback_headers JSONB DEFAULT '{}',
  callback_events TEXT[] DEFAULT ARRAY['assigned','picked_up','delivered','failed','cancelled'],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BROKER DELIVERIES TABLE (mapping + audit)
-- ============================================
CREATE TABLE broker_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broker_id UUID REFERENCES brokers(id) ON DELETE CASCADE NOT NULL,
  delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE NOT NULL,
  broker_job_id TEXT NOT NULL,
  broker_reference TEXT,
  raw_payload JSONB NOT NULL,
  last_status_sent TEXT,
  last_callback_at TIMESTAMPTZ,
  last_callback_status INTEGER,
  callback_attempts INTEGER DEFAULT 0,
  callback_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(broker_id, broker_job_id)
);

-- ============================================
-- BROKER WEBHOOK LOGS TABLE (audit trail)
-- ============================================
CREATE TABLE broker_webhook_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broker_id UUID REFERENCES brokers(id),
  direction TEXT CHECK (direction IN ('inbound', 'outbound')) NOT NULL,
  endpoint TEXT,
  request_body JSONB,
  response_status INTEGER,
  response_body JSONB,
  processing_time_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Brokers
CREATE INDEX idx_brokers_company ON brokers(company_id);
CREATE INDEX idx_brokers_type ON brokers(type);
CREATE INDEX idx_brokers_active ON brokers(is_active) WHERE is_active = true;

-- Broker Deliveries
CREATE INDEX idx_broker_deliveries_broker ON broker_deliveries(broker_id);
CREATE INDEX idx_broker_deliveries_delivery ON broker_deliveries(delivery_id);
CREATE INDEX idx_broker_deliveries_job_id ON broker_deliveries(broker_job_id);
CREATE INDEX idx_broker_deliveries_created ON broker_deliveries(created_at DESC);

-- Broker Webhook Logs
CREATE INDEX idx_broker_webhook_logs_broker ON broker_webhook_logs(broker_id);
CREATE INDEX idx_broker_webhook_logs_direction ON broker_webhook_logs(direction);
CREATE INDEX idx_broker_webhook_logs_created ON broker_webhook_logs(created_at DESC);

-- API Keys (add index for faster hash lookups if not exists)
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_company ON api_keys(company_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Brokers: dispatchers/admins can manage their company's brokers
CREATE POLICY "Dispatchers can view company brokers"
  ON brokers FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND role IN ('dispatcher', 'admin')
    )
  );

CREATE POLICY "Admins can manage brokers"
  ON brokers FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Service role bypass for API routes
CREATE POLICY "Service role full access to brokers"
  ON brokers FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to broker_deliveries"
  ON broker_deliveries FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to broker_webhook_logs"
  ON broker_webhook_logs FOR ALL
  USING (auth.role() = 'service_role');

-- Broker deliveries: dispatchers can view their company's broker deliveries
CREATE POLICY "Dispatchers can view broker deliveries"
  ON broker_deliveries FOR SELECT
  USING (
    broker_id IN (
      SELECT b.id FROM brokers b
      JOIN profiles p ON p.company_id = b.company_id
      WHERE p.id = auth.uid() AND p.role IN ('dispatcher', 'admin')
    )
  );

-- Webhook logs: dispatchers can view their company's webhook logs
CREATE POLICY "Dispatchers can view webhook logs"
  ON broker_webhook_logs FOR SELECT
  USING (
    broker_id IN (
      SELECT b.id FROM brokers b
      JOIN profiles p ON p.company_id = b.company_id
      WHERE p.id = auth.uid() AND p.role IN ('dispatcher', 'admin')
    )
  );

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_broker_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER brokers_updated_at
  BEFORE UPDATE ON brokers
  FOR EACH ROW EXECUTE FUNCTION update_broker_updated_at();
