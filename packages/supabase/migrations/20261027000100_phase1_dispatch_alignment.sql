-- ============================================
-- PHASE 1 DISPATCH ALIGNMENT (P-352, 2026-10-27)
-- ============================================
-- Makes the live database match what the dispatch and driver screens need.
-- ADDITIVE ONLY: new columns, a new private bucket, new RLS policies, and a
-- re-created trigger function. No columns, tables, or rows are dropped or
-- deleted. Safe to re-run.
--
-- Depends on 20261027000000_phase0_security_lockdown.sql (caller_is_staff()).
--
-- "Staff" in policies below = a signed-in profile with role admin or
-- dispatcher, written in the existing inline style:
--   EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','dispatcher'))

-- --------------------------------------------
-- 1. drivers: status, current_delivery_id, last_active_at
-- --------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.drivers ADD COLUMN status text NOT NULL DEFAULT 'pending';

    -- One-time backfill, only on the run that creates the column, so a later
    -- re-run never re-activates a driver dispatch has since suspended.
    -- Runs as the migration owner, so guard_driver_protected_fields allows it.
    UPDATE public.drivers
       SET status = CASE WHEN background_check_status = 'approved' THEN 'active' ELSE 'pending' END;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'drivers_status_check' AND conrelid = 'public.drivers'::regclass
  ) THEN
    ALTER TABLE public.drivers
      ADD CONSTRAINT drivers_status_check
      CHECK (status IN ('pending', 'active', 'suspended', 'inactive'));
  END IF;
END $$;

-- NOTE FOR CLIENT CODE: this creates a SECOND foreign-key path between
-- deliveries and drivers (deliveries.driver_id and drivers.current_delivery_id).
-- PostgREST embeds from deliveries must name the path, e.g.
-- `driver:drivers!driver_id(...)`, or they fail with PGRST201 (ambiguous).
-- All embeds in apps/web were updated in the same change.
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS current_delivery_id uuid
  REFERENCES public.deliveries(id) ON DELETE SET NULL;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_drivers_status ON public.drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_current_delivery_id ON public.drivers(current_delivery_id);

-- --------------------------------------------
-- 2. Guard trigger: drivers cannot activate themselves
-- --------------------------------------------
-- Re-created in full from phase 0, with two additions:
--   * status is forced to 'pending' on a driver's own INSERT and is in the
--     protected UPDATE list (only dispatch approves or suspends).
--   * current_delivery_id stays driver-editable so a driver can release it
--     (set to null) when a job ends, but a non-null value must be a delivery
--     actually assigned to that driver. The deliveries lookup runs as the
--     caller and the driver can only see deliveries assigned to them, so a
--     foreign delivery id fails the check either way.
CREATE OR REPLACE FUNCTION public.guard_driver_protected_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin
  if public.caller_is_staff() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.background_check_status := 'pending';
    new.background_check_date := null;
    new.hipaa_certified := false;
    new.hipaa_cert_expiry := null;
    new.rating := 5.00;
    new.total_deliveries := 0;
    new.loyalty_tier := 'bronze';
    new.status := 'pending';
    new.current_delivery_id := null;
    return new;
  end if;

  if new.background_check_status is distinct from old.background_check_status
     or new.background_check_date is distinct from old.background_check_date
     or new.hipaa_certified is distinct from old.hipaa_certified
     or new.hipaa_cert_expiry is distinct from old.hipaa_cert_expiry
     or new.rating is distinct from old.rating
     or new.total_deliveries is distinct from old.total_deliveries
     or new.loyalty_tier is distinct from old.loyalty_tier
     or new.profile_id is distinct from old.profile_id
     or new.status is distinct from old.status then
    raise exception 'Approval, status, certification, and rating fields are set by dispatch only'
      using errcode = '42501';
  end if;

  if new.current_delivery_id is distinct from old.current_delivery_id
     and new.current_delivery_id is not null
     and not exists (
       select 1 from public.deliveries d
       where d.id = new.current_delivery_id and d.driver_id = new.id
     ) then
    raise exception 'A driver may only point current_delivery_id at a delivery assigned to them'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

DROP TRIGGER IF EXISTS guard_driver_protected_fields ON public.drivers;
CREATE TRIGGER guard_driver_protected_fields
  BEFORE INSERT OR UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.guard_driver_protected_fields();

-- --------------------------------------------
-- 3. Private bucket for proof-of-delivery photos
-- --------------------------------------------
-- Object path convention: <delivery_id>/<timestamp>.jpg
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('delivery-photos', 'delivery-photos', false, 15728640, ARRAY['image/*'])
ON CONFLICT (id) DO NOTHING;

-- Assigned driver may upload under <delivery_id>/ for a delivery assigned to them.
DROP POLICY IF EXISTS "delivery_photos_driver_insert" ON storage.objects;
CREATE POLICY "delivery_photos_driver_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'delivery-photos'
    AND EXISTS (
      SELECT 1
      FROM public.deliveries d
      JOIN public.drivers dr ON dr.id = d.driver_id
      WHERE d.id::text = (storage.foldername(name))[1]
        AND dr.profile_id = auth.uid()
    )
  );

-- Assigned driver may read back their own uploads for that delivery.
DROP POLICY IF EXISTS "delivery_photos_driver_select" ON storage.objects;
CREATE POLICY "delivery_photos_driver_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'delivery-photos'
    AND EXISTS (
      SELECT 1
      FROM public.deliveries d
      JOIN public.drivers dr ON dr.id = d.driver_id
      WHERE d.id::text = (storage.foldername(name))[1]
        AND dr.profile_id = auth.uid()
    )
  );

-- Admin and dispatcher may read every POD photo (signed URLs from dispatch).
DROP POLICY IF EXISTS "delivery_photos_staff_select" ON storage.objects;
CREATE POLICY "delivery_photos_staff_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'delivery-photos'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher'))
  );

-- --------------------------------------------
-- 4. proof_of_delivery (RLS on, had no policies)
-- --------------------------------------------
DROP POLICY IF EXISTS "pod_driver_insert" ON public.proof_of_delivery;
CREATE POLICY "pod_driver_insert" ON public.proof_of_delivery
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.deliveries d
      JOIN public.drivers dr ON dr.id = d.driver_id
      WHERE d.id = proof_of_delivery.delivery_id
        AND dr.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "pod_select" ON public.proof_of_delivery;
CREATE POLICY "pod_select" ON public.proof_of_delivery
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.deliveries d
      JOIN public.drivers dr ON dr.id = d.driver_id
      WHERE d.id = proof_of_delivery.delivery_id
        AND dr.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = proof_of_delivery.delivery_id
        AND d.customer_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher'))
  );

-- --------------------------------------------
-- 5. driver_locations (RLS on, had no policies)
-- --------------------------------------------
DROP POLICY IF EXISTS "driver_locations_own_insert" ON public.driver_locations;
CREATE POLICY "driver_locations_own_insert" ON public.driver_locations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.drivers dr
      WHERE dr.id = driver_locations.driver_id
        AND dr.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "driver_locations_select" ON public.driver_locations;
CREATE POLICY "driver_locations_select" ON public.driver_locations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.drivers dr
      WHERE dr.id = driver_locations.driver_id
        AND dr.profile_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher'))
  );

-- --------------------------------------------
-- 6. delivery_events (RLS on, had no policies)
-- --------------------------------------------
-- Status transitions are already logged by the SECURITY DEFINER trigger
-- log_delivery_status_change(); these policies cover manual context events
-- (who assigned, who cancelled) and reading the timeline.
DROP POLICY IF EXISTS "delivery_events_insert" ON public.delivery_events;
CREATE POLICY "delivery_events_insert" ON public.delivery_events
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.deliveries d
      JOIN public.drivers dr ON dr.id = d.driver_id
      WHERE d.id = delivery_events.delivery_id
        AND dr.profile_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher'))
  );

DROP POLICY IF EXISTS "delivery_events_select" ON public.delivery_events;
CREATE POLICY "delivery_events_select" ON public.delivery_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.deliveries d
      JOIN public.drivers dr ON dr.id = d.driver_id
      WHERE d.id = delivery_events.delivery_id
        AND dr.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_events.delivery_id
        AND d.customer_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher'))
  );

-- --------------------------------------------
-- 7. job_offers: staff create, read, and update offers
-- --------------------------------------------
-- Existing driver policies on job_offers (view/update own) are left untouched.
DROP POLICY IF EXISTS "job_offers_staff_insert" ON public.job_offers;
CREATE POLICY "job_offers_staff_insert" ON public.job_offers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher'))
  );

DROP POLICY IF EXISTS "job_offers_staff_select" ON public.job_offers;
CREATE POLICY "job_offers_staff_select" ON public.job_offers
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher'))
  );

DROP POLICY IF EXISTS "job_offers_staff_update" ON public.job_offers;
CREATE POLICY "job_offers_staff_update" ON public.job_offers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher'))
  );

-- --------------------------------------------
-- 8. deliveries: staff may create jobs
-- --------------------------------------------
-- deliveries.customer_id is NOT NULL live. Until there is a customer picker
-- (Phase 2), staff-created jobs (Curri, Walmart, phone orders) set
-- customer_id to the creating staff user's own id. The policy does not force
-- that, so a later "create on behalf of customer X" form needs no new policy.
DROP POLICY IF EXISTS "deliveries_staff_insert" ON public.deliveries;
CREATE POLICY "deliveries_staff_insert" ON public.deliveries
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher'))
  );

-- --------------------------------------------
-- 9. temperature_logs (RLS on, had no policies)
-- --------------------------------------------
-- Not in the original Phase 1 list; added because the driver temperature
-- sheet and the dispatch delivery page both use this table and were blocked.
DROP POLICY IF EXISTS "temperature_logs_driver_insert" ON public.temperature_logs;
CREATE POLICY "temperature_logs_driver_insert" ON public.temperature_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.deliveries d
      JOIN public.drivers dr ON dr.id = d.driver_id
      WHERE d.id = temperature_logs.delivery_id
        AND dr.id = temperature_logs.driver_id
        AND dr.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "temperature_logs_select" ON public.temperature_logs;
CREATE POLICY "temperature_logs_select" ON public.temperature_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.deliveries d
      JOIN public.drivers dr ON dr.id = d.driver_id
      WHERE d.id = temperature_logs.delivery_id
        AND dr.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = temperature_logs.delivery_id
        AND d.customer_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dispatcher'))
  );
