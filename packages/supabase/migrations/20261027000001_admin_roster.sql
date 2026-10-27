-- ============================================
-- ADMIN ROSTER (P-352, 2026-10-27, Commander order)
-- ============================================
-- Admin access belongs to exactly two accounts:
--   rico@epyccs.com
--   admin@epyccs.com
-- Everyone else holding admin, dispatcher, or staff is reduced to member.
--
-- Run AFTER admin@epyccs.com exists in Authentication > Users.
-- Safety: the demotion step refuses to run unless both epyccs.com accounts
-- exist and are admin, so this can never leave the system with no admin.

BEGIN;

-- 1. Promote the two epyccs.com accounts.
UPDATE public.profiles p
SET role = 'admin', updated_at = now()
FROM auth.users u
WHERE u.id = p.id
  AND lower(u.email) IN ('rico@epyccs.com', 'admin@epyccs.com');

-- 2. Demote every other staff account, but only if step 1 fully succeeded.
DO $$
DECLARE
  v_ready integer;
BEGIN
  SELECT count(*) INTO v_ready
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE lower(u.email) IN ('rico@epyccs.com', 'admin@epyccs.com')
    AND p.role = 'admin';

  IF v_ready < 2 THEN
    RAISE EXCEPTION 'Stopped: rico@epyccs.com and admin@epyccs.com must both exist before other admins are removed (found % of 2). Create admin@epyccs.com first.', v_ready;
  END IF;

  UPDATE public.profiles p
  SET role = 'member', updated_at = now()
  FROM auth.users u
  WHERE u.id = p.id
    AND p.role IN ('admin', 'dispatcher', 'staff')
    AND lower(u.email) NOT IN ('rico@epyccs.com', 'admin@epyccs.com');
END $$;

-- 3. Show the result.
SELECT u.email, p.role
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.role IN ('admin', 'dispatcher', 'staff')
ORDER BY u.email;

COMMIT;
