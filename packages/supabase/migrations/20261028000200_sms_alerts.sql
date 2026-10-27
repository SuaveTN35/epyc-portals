-- ============================================
-- SMS ALERTS (P-352 Phase 3, 2026-10-28)
-- ============================================
-- Driver text-message consent and a log of every text sent through Twilio.
-- ADDITIVE ONLY: two new profiles columns (default off), one new table, one
-- trigger, RLS policies. No existing column, policy, or row is changed.
-- Safe to re-run.
--
-- Depends on 20261027000000_phase0_security_lockdown.sql (caller_is_staff()).

-- --------------------------------------------
-- 1. profiles.sms_opt_in / sms_opt_in_at
-- --------------------------------------------
-- Drivers tick "Text me job offers and updates..." during onboarding or on
-- their profile. Texts go to a driver only when sms_opt_in is true. The
-- existing "Users can update own profile" policy lets them change it.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sms_opt_in boolean NOT NULL DEFAULT false;

-- When consent was last given (record for carrier / A2P 10DLC audits). Set
-- only by the trigger below, never trusted from the client.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sms_opt_in_at timestamptz;

CREATE OR REPLACE FUNCTION public.stamp_sms_opt_in()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    new.sms_opt_in_at := case when new.sms_opt_in then now() else null end;
  elsif new.sms_opt_in is distinct from old.sms_opt_in then
    new.sms_opt_in_at := case when new.sms_opt_in then now() else null end;
  else
    new.sms_opt_in_at := old.sms_opt_in_at;
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS stamp_sms_opt_in ON public.profiles;
CREATE TRIGGER stamp_sms_opt_in
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.stamp_sms_opt_in();

-- --------------------------------------------
-- 2. sms_log
-- --------------------------------------------
-- One row per text attempted once Twilio is configured (sent or failed).
-- Stands alone on purpose: profile_id and delivery_id are plain uuids with no
-- foreign keys, so the log survives a deleted profile or job.
-- Written only by the server with the service role (no INSERT policy).
CREATE TABLE IF NOT EXISTS public.sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_number text NOT NULL,
  profile_id uuid,
  kind text NOT NULL,
  delivery_id uuid,
  twilio_sid text,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sms_log_kind_check CHECK (kind IN ('job_offer', 'job_assigned', 'problem_ops'))
);

CREATE INDEX IF NOT EXISTS idx_sms_log_to_number ON public.sms_log(to_number);
CREATE INDEX IF NOT EXISTS idx_sms_log_delivery_kind ON public.sms_log(delivery_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_log_profile ON public.sms_log(profile_id);

ALTER TABLE public.sms_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sms_log_staff_select" ON public.sms_log;
CREATE POLICY "sms_log_staff_select" ON public.sms_log
  FOR SELECT TO authenticated
  USING (public.caller_is_staff());

REVOKE ALL ON public.sms_log FROM anon;
REVOKE ALL ON public.sms_log FROM authenticated;
GRANT SELECT ON public.sms_log TO authenticated;
