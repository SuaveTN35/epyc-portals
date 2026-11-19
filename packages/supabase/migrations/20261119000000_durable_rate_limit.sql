-- ============================================
-- DURABLE RATE LIMIT FOR PUBLIC FORMS (2026-11-19)
-- ============================================
-- The in-memory limiter in apps/web/lib/rate-limit.ts counts per serverless
-- instance, so on Vercel the real limit is a multiple of the configured one.
-- This keeps one shared count per key in Postgres.
--
-- ADDITIVE / SAFE TO RE-RUN. Nothing is dropped or deleted except expired
-- counter rows. Keys are SHA-256 hashes made by the server; no raw IPs are
-- stored. Only the service role can call the function or see the table.

CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
-- No policies: anon and authenticated get nothing.
REVOKE ALL ON public.rate_limit_hits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE (allowed boolean, hits integer, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_start timestamptz;
  v_count integer;
begin
  if p_key is null or length(p_key) > 200
     or p_limit is null or p_limit < 1
     or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'rate_limit_hit: bad arguments';
  end if;

  -- Fixed window aligned to the epoch.
  v_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limit_hits as r (key, window_start, count)
  values (p_key, v_start, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning r.count into v_count;

  -- Occasional cleanup of old windows (about 1 call in 50).
  if random() < 0.02 then
    delete from public.rate_limit_hits where window_start < now() - interval '1 day';
  end if;

  return query select v_count <= p_limit, v_count, v_start + make_interval(secs => p_window_seconds);
end;
$function$;

REVOKE ALL ON FUNCTION public.rate_limit_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, integer, integer) TO service_role;
