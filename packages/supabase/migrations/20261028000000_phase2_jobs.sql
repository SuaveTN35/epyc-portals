-- ============================================
-- PHASE 2 JOBS (P-352, 2026-10-28)
-- ============================================
-- Supports the dispatch "New Job" screen and driver job offers.
-- ADDITIVE ONLY: new columns, a CHECK constraint, and a new trigger. No
-- columns, tables, or rows are dropped or deleted. Safe to re-run.
--
-- Depends on 20261027000000_phase0_security_lockdown.sql (caller_is_staff())
-- and 20261027000100_phase1_dispatch_alignment.sql (drivers.status).

-- --------------------------------------------
-- 1. deliveries.source / deliveries.source_reference
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
