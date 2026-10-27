-- ============================================
-- PUSH SUBSCRIPTIONS (P-352 Phase 3, 2026-10-28)
-- ============================================
-- Web push groundwork for the EPYC Driver app. Stores one row per phone /
-- browser that turned on job alerts. Nothing sends pushes yet (Phase 3b adds
-- the VAPID keys and the server-side sender, which reads this table with the
-- service role).
-- ADDITIVE ONLY: one new table, its indexes, and its RLS policies. No
-- existing table, column, policy, or row is changed. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_https CHECK (endpoint LIKE 'https://%'),
  CONSTRAINT push_subscriptions_user_agent_len CHECK (user_agent IS NULL OR char_length(user_agent) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_profile_id
  ON public.push_subscriptions(profile_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- A signed-in user manages only their own subscriptions. No UPDATE policy:
-- the app replaces a row by delete + insert. Staff get no direct access; the
-- Phase 3b sender uses the service role, which bypasses RLS.
DROP POLICY IF EXISTS "push_subscriptions_own_select" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_own_select" ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_own_insert" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_own_insert" ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_own_delete" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_own_delete" ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (profile_id = auth.uid());

-- Explicit grants (anon gets nothing).
REVOKE ALL ON public.push_subscriptions FROM anon;
GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO authenticated;
