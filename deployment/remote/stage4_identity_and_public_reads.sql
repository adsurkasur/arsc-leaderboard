-- Stage 4: Rapor-backed identity linking and sanitized public leaderboard reads
--
-- SAFETY CONTRACT
-- - Additive only: creates five new functions and grants.
-- - Does not alter or drop Rapor, Halo PSDM, or shared tables/functions.
-- - Does not expose private Rapor tables to anon/authenticated roles.
-- - Identity linking can only be executed by service_role after the application
--   has verified a Rapor access code server-side.
-- - Run manually only after a separate read-only preflight and explicit approval.

BEGIN;

DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(required_object, ', ' ORDER BY required_object)
  INTO v_missing
  FROM (
    VALUES
      ('public.profiles'),
      ('public.members'),
      ('public.member_release_links'),
      ('public.participation_logs'),
      ('public.competitions'),
      ('public.rapor_releases'),
      ('public.rapor_members'),
      ('public.rapor_access_codes')
  ) AS required(required_object)
  WHERE to_regclass(required_object) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stage 4 prerequisites missing: %', v_missing;
  END IF;

  IF to_regprocedure('public.get_leaderboard_reference_members()') IS NULL THEN
    RAISE EXCEPTION 'Stage 4 prerequisite missing: public.get_leaderboard_reference_members()';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    INNER JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'get_public_leaderboard',
        'get_public_member_participations',
        'get_public_category_participation_counts',
        'upsert_leaderboard_reference_member',
        'link_leaderboard_profile_from_reference'
      ])
  ) THEN
    RAISE EXCEPTION 'Stage 4 function collision detected; stop for manual review.';
  END IF;
END;
$$;

CREATE FUNCTION public.get_public_leaderboard()
RETURNS TABLE (
  profile_id uuid,
  full_name text,
  bidang_biro text,
  avatar_url text,
  total_participation_count integer,
  last_activity_at timestamptz,
  created_at timestamptz,
  is_identity_verified boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p.id AS profile_id,
    p.full_name,
    p.bidang_biro,
    p.avatar_url,
    count(pl.id)::integer AS total_participation_count,
    max(COALESCE(pl.verified_at, pl.created_at)) AS last_activity_at,
    p.created_at,
    true AS is_identity_verified
  FROM public.profiles p
  LEFT JOIN public.participation_logs pl
    ON pl.profile_id = p.id
   AND pl.status = 'approved'
  WHERE p.member_id IS NOT NULL
    AND p.link_status IN ('linked_exact', 'manually_linked')
  GROUP BY p.id, p.full_name, p.bidang_biro, p.avatar_url, p.created_at
  ORDER BY
    count(pl.id) DESC,
    max(COALESCE(pl.verified_at, pl.created_at)) ASC NULLS LAST,
    p.created_at ASC;
$$;

CREATE FUNCTION public.get_public_member_participations(p_profile_id uuid)
RETURNS TABLE (
  participation_id uuid,
  competition_id uuid,
  competition_title text,
  competition_date date,
  competition_category text,
  participation_date timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    pl.id AS participation_id,
    c.id AS competition_id,
    c.title AS competition_title,
    c.date AS competition_date,
    c.category AS competition_category,
    pl.participation_date,
    pl.created_at
  FROM public.participation_logs pl
  INNER JOIN public.competitions c ON c.id = pl.competition_id
  WHERE pl.profile_id = p_profile_id
    AND pl.status = 'approved'
  ORDER BY COALESCE(pl.participation_date, pl.created_at) DESC;
$$;

CREATE FUNCTION public.get_public_category_participation_counts(p_category text)
RETURNS TABLE (
  profile_id uuid,
  participation_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    pl.profile_id,
    count(*) AS participation_count
  FROM public.participation_logs pl
  INNER JOIN public.competitions c ON c.id = pl.competition_id
  WHERE pl.status = 'approved'
    AND c.category = p_category
  GROUP BY pl.profile_id;
$$;

CREATE FUNCTION public.upsert_leaderboard_reference_member(
  p_release_member_code text,
  p_release_code text,
  p_canonical_name text,
  p_unit text,
  p_position text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_member_id uuid;
  v_member_count integer;
  v_normalized_name text;
  v_created boolean := false;
BEGIN
  IF NULLIF(btrim(p_release_member_code), '') IS NULL
    OR NULLIF(btrim(p_release_code), '') IS NULL
    OR NULLIF(btrim(p_canonical_name), '') IS NULL
    OR NULLIF(btrim(p_unit), '') IS NULL
  THEN
    RAISE EXCEPTION 'Incomplete Rapor identity reference';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(btrim(p_release_code) || ':' || btrim(p_release_member_code), 0)
  );

  SELECT l.member_id
  INTO v_member_id
  FROM public.member_release_links l
  WHERE l.release_code = btrim(p_release_code)
    AND l.release_member_code = btrim(p_release_member_code);

  IF v_member_id IS NULL THEN
    v_normalized_name := lower(regexp_replace(btrim(p_canonical_name), '\s+', ' ', 'g'));

    SELECT count(*), (array_agg(m.id ORDER BY m.id))[1]
    INTO v_member_count, v_member_id
    FROM public.members m
    WHERE lower(regexp_replace(btrim(m.canonical_name), '\s+', ' ', 'g')) = v_normalized_name;

    IF v_member_count > 1 THEN
      RAISE EXCEPTION 'Ambiguous canonical member identity';
    ELSIF v_member_count = 0 THEN
      INSERT INTO public.members (canonical_name)
      VALUES (btrim(p_canonical_name))
      RETURNING id INTO v_member_id;
      v_created := true;
    END IF;

    INSERT INTO public.member_release_links (
      member_id,
      release_code,
      release_member_code,
      unit,
      position,
      evaluation_status
    )
    VALUES (
      v_member_id,
      btrim(p_release_code),
      btrim(p_release_member_code),
      upper(btrim(p_unit)),
      NULLIF(btrim(p_position), ''),
      'synced_reference'
    );
  ELSE
    UPDATE public.member_release_links
    SET
      unit = upper(btrim(p_unit)),
      position = NULLIF(btrim(p_position), ''),
      evaluation_status = CASE
        WHEN evaluation_status = 'verified_by_access_code' THEN evaluation_status
        ELSE 'synced_reference'
      END,
      updated_at = now()
    WHERE release_code = btrim(p_release_code)
      AND release_member_code = btrim(p_release_member_code);
  END IF;

  UPDATE public.members
  SET canonical_name = btrim(p_canonical_name), updated_at = now()
  WHERE id = v_member_id;

  RETURN jsonb_build_object(
    'member_id', v_member_id,
    'created', v_created,
    'release_member_code', btrim(p_release_member_code),
    'release_code', btrim(p_release_code)
  );
END;
$$;

CREATE FUNCTION public.link_leaderboard_profile_from_reference(
  p_user_id uuid,
  p_release_member_code text,
  p_release_code text,
  p_canonical_name text,
  p_unit text,
  p_position text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_member_id uuid;
  v_member_count integer;
  v_bidang_biro text;
  v_normalized_name text;
BEGIN
  IF p_user_id IS NULL
    OR NULLIF(btrim(p_release_member_code), '') IS NULL
    OR NULLIF(btrim(p_release_code), '') IS NULL
    OR NULLIF(btrim(p_canonical_name), '') IS NULL
    OR NULLIF(btrim(p_unit), '') IS NULL
  THEN
    RAISE EXCEPTION 'Incomplete Rapor identity reference';
  END IF;

  SELECT p.*
  INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leaderboard profile not found';
  END IF;

  v_bidang_biro := CASE upper(btrim(p_unit))
    WHEN 'KETUM' THEN 'Ketua Umum (KETUM)'
    WHEN 'KETUA UMUM' THEN 'Ketua Umum (KETUM)'
    WHEN 'PSDM' THEN 'Biro Pengembangan Sumber Daya Mahasiswa (PSDM)'
    WHEN 'ADKEU' THEN 'Biro Administrasi dan Keuangan (ADKEU)'
    WHEN 'PENKOM' THEN 'Bidang Kepenulisan dan Kompetisi (PENKOM)'
    WHEN 'RISTEK' THEN 'Bidang Riset dan Teknologi (RISTEK)'
    WHEN 'INFOKOM' THEN 'Bidang Informasi dan Komunikasi (INFOKOM)'
    ELSE NULL
  END;

  IF v_bidang_biro IS NULL THEN
    RAISE EXCEPTION 'Unsupported Rapor unit: %', p_unit;
  END IF;

  -- Serialize claims for the same release identity to prevent races.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(btrim(p_release_code) || ':' || btrim(p_release_member_code), 0)
  );

  SELECT l.member_id
  INTO v_member_id
  FROM public.member_release_links l
  WHERE l.release_code = btrim(p_release_code)
    AND l.release_member_code = btrim(p_release_member_code);

  IF v_member_id IS NULL THEN
    v_normalized_name := lower(regexp_replace(btrim(p_canonical_name), '\s+', ' ', 'g'));

    SELECT count(*), (array_agg(m.id ORDER BY m.id))[1]
    INTO v_member_count, v_member_id
    FROM public.members m
    WHERE lower(regexp_replace(btrim(m.canonical_name), '\s+', ' ', 'g')) = v_normalized_name;

    IF v_member_count > 1 THEN
      RAISE EXCEPTION 'Ambiguous canonical member identity';
    ELSIF v_member_count = 0 THEN
      INSERT INTO public.members (canonical_name)
      VALUES (btrim(p_canonical_name))
      RETURNING id INTO v_member_id;
    END IF;

    INSERT INTO public.member_release_links (
      member_id,
      release_code,
      release_member_code,
      unit,
      position,
      evaluation_status
    )
    VALUES (
      v_member_id,
      btrim(p_release_code),
      btrim(p_release_member_code),
      upper(btrim(p_unit)),
      NULLIF(btrim(p_position), ''),
      'verified_by_access_code'
    );
  ELSE
    UPDATE public.member_release_links
    SET
      unit = upper(btrim(p_unit)),
      position = NULLIF(btrim(p_position), ''),
      evaluation_status = 'verified_by_access_code',
      updated_at = now()
    WHERE release_code = btrim(p_release_code)
      AND release_member_code = btrim(p_release_member_code);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.member_id = v_member_id
      AND p.user_id IS DISTINCT FROM p_user_id
  ) THEN
    RAISE EXCEPTION 'Rapor identity is already linked to another account';
  END IF;

  IF v_profile.member_id IS NOT NULL
    AND v_profile.member_id IS DISTINCT FROM v_member_id
    AND v_profile.link_status IN ('linked_exact', 'manually_linked')
  THEN
    RAISE EXCEPTION 'Profile is already linked to a different Rapor identity';
  END IF;

  UPDATE public.members
  SET canonical_name = btrim(p_canonical_name), updated_at = now()
  WHERE id = v_member_id;

  UPDATE public.profiles
  SET
    member_id = v_member_id,
    full_name = btrim(p_canonical_name),
    bidang_biro = v_bidang_biro,
    link_status = 'linked_exact',
    updated_at = now()
  WHERE id = v_profile.id;

  RETURN jsonb_build_object(
    'profile_id', v_profile.id,
    'member_id', v_member_id,
    'full_name', btrim(p_canonical_name),
    'bidang_biro', v_bidang_biro,
    'link_status', 'linked_exact'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_leaderboard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_member_participations(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_category_participation_counts(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_leaderboard_reference_member(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_leaderboard_profile_from_reference(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_public_leaderboard() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_member_participations(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_category_participation_counts(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_leaderboard_reference_member(text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.link_leaderboard_profile_from_reference(uuid, text, text, text, text, text) TO service_role;

COMMIT;
