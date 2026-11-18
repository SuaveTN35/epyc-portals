-- ============================================
-- CLIENT DELIVERY ALERTS (2026-11-18)
-- ============================================
-- Texts and emails to the client who booked a job when a driver is assigned,
-- when the package is picked up, and when it is delivered.
-- ADDITIVE ONLY: two new profiles columns, one new table with RLS, and a
-- wider sms_log.kind check (three new allowed values; every existing value
-- stays allowed). No column, table, policy, or row is dropped or deleted.
-- Safe to re-run.
--
-- Depends on 20261027000000_phase0_security_lockdown.sql (caller_is_staff())
-- and 20261028000300_sms_alerts.sql (sms_log, profiles.sms_opt_in).

-- --------------------------------------------
-- 1. profiles.email_notifications / profiles.marketing_emails
-- --------------------------------------------
-- The client Settings page already saves these two, but the columns were
-- never created, so saving notification settings failed. Email delivery
-- updates default to on; marketing defaults to off.
-- Client text updates use the existing profiles.sms_opt_in (default off),
-- the same consent flag and timestamp driver texts use.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_notifications boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_emails boolean NOT NULL DEFAULT false;

-- --------------------------------------------
-- 2. sms_log.kind: allow the three client alert kinds
-- --------------------------------------------
ALTER TABLE public.sms_log DROP CONSTRAINT IF EXISTS sms_log_kind_check;
ALTER TABLE public.sms_log
  ADD CONSTRAINT sms_log_kind_check CHECK (
    kind IN (
      'job_offer', 'job_assigned', 'problem_ops',
      'client_assigned', 'client_picked_up', 'client_delivered'
    )
  );

-- --------------------------------------------
-- 3. client_alerts: one row per (job, alert, channel)
-- --------------------------------------------
-- The server inserts the row BEFORE sending. The unique index makes a second
-- attempt (retry, double tap, two dispatchers) fail the insert, so each alert
-- goes out at most once. delivery_id has no foreign key on purpose, like
-- sms_log, so the record survives if a job is ever removed.
-- Written only by the server with the service role (no INSERT policy).
CREATE TABLE IF NOT EXISTS public.client_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL,
  event text NOT NULL,
  channel text NOT NULL,
  status text NOT NULL,
  provider_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_alerts_event_check CHECK (event IN ('assigned', 'picked_up', 'delivered')),
  CONSTRAINT client_alerts_channel_check CHECK (channel IN ('email', 'sms')),
  CONSTRAINT client_alerts_status_len CHECK (char_length(status) <= 120)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_alerts_once
  ON public.client_alerts(delivery_id, event, channel);

ALTER TABLE public.client_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_alerts_staff_select" ON public.client_alerts;
CREATE POLICY "client_alerts_staff_select" ON public.client_alerts
  FOR SELECT TO authenticated
  USING (public.caller_is_staff());

REVOKE ALL ON public.client_alerts FROM anon;
REVOKE ALL ON public.client_alerts FROM authenticated;
GRANT SELECT ON public.client_alerts TO authenticated;
