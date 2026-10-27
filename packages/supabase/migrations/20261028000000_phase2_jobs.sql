-- ============================================
-- PHASE 2 JOBS (P-352, 2026-10-28)
-- ============================================
-- Supports the dispatch "New Job" screen, driver job offers, and the
-- driver pickup-to-drop-off proof flow.
-- ADDITIVE ONLY: new columns, CHECK constraints, indexes, and a new
-- trigger. No columns, tables, or rows are dropped or deleted. Safe to
-- re-run.
--
-- Depends on 20261027000000_phase0_security_lockdown.sql (caller_is_staff())
-- and 20261027000100_phase1_dispatch_alignment.sql (drivers.status).

-- --------------------------------------------
-- 1. deliveries.source / source_reference / loading_required
-- --------------------------------------------
-- Where a job came from (Curri, Walmart Spark, a broker, a phone call) and
-- that platform's own job or order number, so dispatch can reconcile payouts.
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'direct';

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS source_reference text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deliveries_source_check' AND conrelid = 'public.deliveries'::regclass
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT deliveries_source_check
      CHECK (source IN ('direct', 'curri', 'walmart_spark', 'dispatch_app', 'broker', 'other'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_deliveries_source ON public.deliveries(source);

-- Driver must load or unload (no dock help). Shown as a tag on the job.
-- Drivers cannot change it: the guard trigger in section 3 allow-lists only
-- status and pickup/delivery times.
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS loading_required boolean NOT NULL DEFAULT false;

-- --------------------------------------------
-- 2. proof_of_delivery.stage / proof_of_delivery.photo_kind
-- --------------------------------------------
-- Proof is now captured at both ends of the job:
--   stage 'pickup'   -> item photos (photo_kind 'item') and the receipt or
--                       bill of lading (photo_kind 'receipt')
--   stage 'delivery' -> where it was left ('placement'), who took it
--                       ('recipient'), and the signature row
-- Existing rows default to 'delivery', which is what they were.
ALTER TABLE public.proof_of_delivery
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'delivery';

ALTER TABLE public.proof_of_delivery
  ADD COLUMN IF NOT EXISTS photo_kind text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proof_of_delivery_stage_check' AND conrelid = 'public.proof_of_delivery'::regclass
  ) THEN
    ALTER TABLE public.proof_of_delivery
      ADD CONSTRAINT proof_of_delivery_stage_check
      CHECK (stage IN ('pickup', 'delivery'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proof_of_delivery_photo_kind_check' AND conrelid = 'public.proof_of_delivery'::regclass
  ) THEN
    ALTER TABLE public.proof_of_delivery
      ADD CONSTRAINT proof_of_delivery_photo_kind_check
      CHECK (photo_kind IS NULL OR photo_kind IN ('item', 'receipt', 'placement', 'recipient', 'other'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_proof_of_delivery_delivery_stage
  ON public.proof_of_delivery(delivery_id, stage);

-- --------------------------------------------
-- 3. Guard trigger: what a non-staff caller may change on a delivery
-- --------------------------------------------
-- RLS already limits driver UPDATEs to deliveries assigned to them, but it
-- cannot limit WHICH columns change. Without this, an assigned driver could
-- rewrite driver_payout, addresses, or jump straight to 'delivered'.
--
-- For any caller that is not staff (caller_is_staff() is false):
--   * Only status, actual_pickup_time, actual_delivery_time (and updated_at,
--     which update_deliveries_updated_at sets anyway) may change.
--   * status moves forward only along
--       assigned -> en_route_pickup -> arrived_pickup -> picked_up
--                -> en_route_delivery -> arrived_delivery -> delivered
--     The en_route_* steps may be skipped (drivers tap "Arrived" directly).
--     Any active status may move to 'failed'.
--   * 'picked_up' requires a pickup-stage item photo AND (a pickup-stage
--     receipt photo OR a pickup-stage row with a non-empty note, used for
--     "No receipt given").
--   * 'delivered' requires a delivery-stage placement photo AND, when the
--     job has requires_signature, (a signature row OR a delivery-stage row
--     whose notes start with 'Left without signature:').
-- Violations raise errcode 42501.
--
-- SECURITY INVOKER on purpose: caller_is_staff() must see the real caller,
-- and the proof lookups run under the caller's RLS (pod_select lets the
-- assigned driver read their own proof rows). The existing SECURITY DEFINER
-- triggers log_delivery_status_change() and update_driver_stats() are AFTER
-- triggers that write other tables, so they are unaffected. Service-role
-- routes (offer accept) are staff by caller_is_staff() and pass through.
CREATE OR REPLACE FUNCTION public.guard_delivery_driver_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  v_flow text[] := array[
    'assigned', 'en_route_pickup', 'arrived_pickup', 'picked_up',
    'en_route_delivery', 'arrived_delivery', 'delivered'
  ];
  v_allowed text[] := array['status', 'actual_pickup_time', 'actual_delivery_time', 'updated_at'];
  v_old_idx int;
  v_new_idx int;
  i int;
begin
  if public.caller_is_staff() then
    return new;
  end if;

  -- Column allow-list: compare every other column, including ones added later.
  if (to_jsonb(new) - v_allowed) is distinct from (to_jsonb(old) - v_allowed) then
    raise exception 'Drivers may only update job status and pickup/delivery times'
      using errcode = '42501';
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'failed' then
    if old.status = any (v_flow[1:6]) then
      return new;
    end if;
    raise exception 'A job can only be marked failed while it is in progress'
      using errcode = '42501';
  end if;

  v_old_idx := array_position(v_flow, old.status);
  v_new_idx := array_position(v_flow, new.status);

  if v_old_idx is null or v_new_idx is null or v_new_idx <= v_old_idx then
    raise exception 'Status change % -> % is not allowed', old.status, new.status
      using errcode = '42501';
  end if;

  -- Only the en_route_* steps may be skipped.
  for i in (v_old_idx + 1) .. (v_new_idx - 1) loop
    if v_flow[i] not in ('en_route_pickup', 'en_route_delivery') then
      raise exception 'Status change % -> % skips %', old.status, new.status, v_flow[i]
        using errcode = '42501';
    end if;
  end loop;

  if new.status = 'picked_up' then
    if not exists (
         select 1 from public.proof_of_delivery p
         where p.delivery_id = new.id and p.stage = 'pickup'
           and p.type = 'photo' and p.photo_kind = 'item' and p.photo_url is not null
       )
       or not (
         exists (
           select 1 from public.proof_of_delivery p
           where p.delivery_id = new.id and p.stage = 'pickup'
             and p.type = 'photo' and p.photo_kind = 'receipt' and p.photo_url is not null
         )
         or exists (
           select 1 from public.proof_of_delivery p
           where p.delivery_id = new.id and p.stage = 'pickup'
             and nullif(btrim(p.notes), '') is not null
         )
       ) then
      raise exception 'Pickup needs an item photo and a receipt photo (or a no-receipt note)'
        using errcode = '42501';
    end if;
  end if;

  if new.status = 'delivered' then
    if not exists (
         select 1 from public.proof_of_delivery p
         where p.delivery_id = new.id and p.stage = 'delivery'
           and p.type = 'photo' and p.photo_kind = 'placement' and p.photo_url is not null
       )
       or (
         coalesce(new.requires_signature, false)
         and not exists (
           select 1 from public.proof_of_delivery p
           where p.delivery_id = new.id and p.type = 'signature'
             and p.signature_data is not null
         )
         and not exists (
           select 1 from public.proof_of_delivery p
           where p.delivery_id = new.id and p.stage = 'delivery'
             and p.notes ilike 'left without signature:%'
         )
       ) then
      raise exception 'Delivery needs a placement photo and a signature (or a left-without-signature note)'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.guard_delivery_driver_update() FROM PUBLIC, anon, authenticated;

-- Named so it sorts before update_deliveries_updated_at (BEFORE triggers fire
-- in name order); updated_at is on the allow-list either way.
DROP TRIGGER IF EXISTS guard_delivery_driver_update ON public.deliveries;
CREATE TRIGGER guard_delivery_driver_update
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_driver_update();

-- --------------------------------------------
-- AEQUALIS QA B1 (P-352 Phase 2): drivers must not rewrite job_offers.
-- The accept route trusts offer.status / expires_at / delivery_id; a driver
-- editing their own offer row could resurrect an expired offer or repoint it
-- at another booked job. Drivers now respond only via
-- /api/driver/offers/[id]/respond (service role, ownership checked).
-- Drivers keep SELECT on their own offers.
-- --------------------------------------------
DROP POLICY IF EXISTS "Drivers can update own job offers" ON public.job_offers;
