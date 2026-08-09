-- Manual, narrowly scoped operator action for the ARSC Supabase project.
-- Replace the placeholder email once, review it, then run the complete file
-- in the Supabase SQL Editor. This does not change the Halo PSDM role,
-- Rapor identity, Leaderboard profile, or any participation data.

BEGIN;

CREATE TEMP TABLE _leaderboard_admin_target (
  email text PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO _leaderboard_admin_target (email)
VALUES ('GANTI_DENGAN_EMAIL_AKUN_ANDA');

DO $$
DECLARE
  v_target_email text;
  v_target_user_id uuid;
  v_match_count integer;
BEGIN
  SELECT btrim(email)
  INTO v_target_email
  FROM _leaderboard_admin_target;

  IF v_target_email LIKE 'GANTI_DENGAN_%'
    OR v_target_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  THEN
    RAISE EXCEPTION 'Replace the target email placeholder with a valid account email before running this script';
  END IF;

  IF to_regclass('auth.users') IS NULL
    OR to_regclass('public.user_roles') IS NULL
    OR to_regtype('public.app_role') IS NULL
  THEN
    RAISE EXCEPTION 'Required auth or Leaderboard role objects are missing';
  END IF;

  SELECT
    count(*)::integer,
    (array_agg(id ORDER BY created_at))[1]
  INTO v_match_count, v_target_user_id
  FROM auth.users
  WHERE lower(email) = lower(v_target_email);

  IF v_match_count <> 1 OR v_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Expected exactly one auth user for %, found %', v_target_email, v_match_count;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_target_user_id, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = v_target_user_id
      AND role = 'admin'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Leaderboard admin role was not persisted';
  END IF;
END;
$$;

SELECT
  'leaderboard_admin_assignment' AS result,
  au.id AS auth_user_id,
  au.email,
  ur.role::text AS leaderboard_role,
  hu.role AS halo_psdm_role,
  'Rapor identity was not modified' AS protected_identity_status
FROM _leaderboard_admin_target target
INNER JOIN auth.users au ON lower(au.email) = lower(target.email)
INNER JOIN public.user_roles ur
  ON ur.user_id = au.id
 AND ur.role = 'admin'::public.app_role
LEFT JOIN public.users hu ON hu.id = au.id;

COMMIT;
