-- Stage 4: shared ARSC identity, Rapor-backed verification, and public reads
--
-- SAFETY CONTRACT
-- - Additive: creates one shared identity table, Stage 4 functions, and three
--   narrowly scoped triggers on the existing Halo and Leaderboard projections.
-- - Never changes auth credentials or password hashes.
-- - Never writes to Rapor tables; they remain read-only identity evidence.
-- - Preserves Halo PSDM operational fields (role, whatsapp, activation state)
--   while synchronizing verified name, unit, position, and avatar projection.
-- - Identity linking is service_role-only after server-side access-code checks.
-- - Run manually only after the revised read-only preflight and approval.

BEGIN;

DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(required_object, ', ' ORDER BY required_object)
  INTO v_missing
  FROM (
    VALUES
      ('auth.users'),
      ('public.users'),
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

  IF to_regprocedure('public.get_leaderboard_reference_members()') IS NULL
    OR to_regprocedure('public.leaderboard_update_updated_at()') IS NULL
  THEN
    RAISE EXCEPTION 'Stage 4 prerequisite function is missing.';
  END IF;

  IF to_regclass('public.arsc_identities') IS NOT NULL THEN
    RAISE EXCEPTION 'Stage 4 table collision: public.arsc_identities already exists.';
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
        'link_arsc_account_from_reference',
        'get_my_arsc_identity',
        'set_shared_profile_avatar',
        'protect_verified_arsc_identity_fields',
        'protect_verified_leaderboard_identity_fields',
        'sync_halo_avatar_to_leaderboard'
      ])
  ) THEN
    RAISE EXCEPTION 'Stage 4 function collision detected; stop for manual review.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger t
    INNER JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
    INNER JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND (
        (c.relname = 'users' AND t.tgname = ANY (ARRAY[
          'arsc_verified_identity_guard',
          'arsc_shared_avatar_sync'
        ]))
        OR (c.relname = 'profiles' AND t.tgname = 'arsc_verified_profile_guard')
      )
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Stage 4 trigger collision detected; stop for manual review.';
  END IF;
END;
$$;

CREATE TABLE public.arsc_identities (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid NOT NULL UNIQUE REFERENCES public.members(id) ON DELETE RESTRICT,
  verified_release_code text NOT NULL,
  verified_release_member_code text NOT NULL,
  verification_source text NOT NULL DEFAULT 'rapor_access_code',
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT arsc_identities_release_identity_key
    UNIQUE (verified_release_code, verified_release_member_code),
  CONSTRAINT arsc_identities_source_check
    CHECK (verification_source IN ('rapor_access_code', 'admin_verified'))
);

ALTER TABLE public.arsc_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own shared identity"
ON public.arsc_identities
FOR SELECT
TO authenticated
USING (auth.uid() = auth_user_id);

GRANT ALL ON public.arsc_identities TO postgres, service_role, supabase_admin;
GRANT SELECT ON public.arsc_identities TO authenticated;

CREATE TRIGGER arsc_identities_updated_at
BEFORE UPDATE ON public.arsc_identities
FOR EACH ROW EXECUTE FUNCTION public.leaderboard_update_updated_at();

CREATE FUNCTION public.protect_verified_arsc_identity_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text;
  v_unit text;
  v_position text;
BEGIN
  SELECT m.canonical_name, l.unit, l.position
  INTO v_name, v_unit, v_position
  FROM public.arsc_identities i
  INNER JOIN public.members m ON m.id = i.member_id
  INNER JOIN public.member_release_links l
    ON l.member_id = i.member_id
   AND l.release_code = i.verified_release_code
   AND l.release_member_code = i.verified_release_member_code
  WHERE i.auth_user_id = NEW.id;

  IF FOUND THEN
    NEW.name := v_name;
    NEW.biro := upper(v_unit);
    NEW.jabatan := CASE
      WHEN upper(COALESCE(v_position, '')) LIKE '%PENGURUS%HARIAN%' THEN 'PENGURUS_HARIAN'
      WHEN upper(COALESCE(v_position, '')) LIKE '%STAF%AHLI%' THEN 'STAF_AHLI'
      WHEN upper(COALESCE(v_position, '')) LIKE '%STAF%' THEN 'STAF'
      WHEN upper(COALESCE(v_position, '')) LIKE '%ANGGOTA%MUDA%' THEN 'ANGGOTA_MUDA'
      ELSE COALESCE(NULLIF(NEW.jabatan, ''), 'ANGGOTA_MUDA')
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.sync_halo_avatar_to_leaderboard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
  SET avatar_url = NEW.avatar_url, updated_at = now()
  WHERE user_id = NEW.id
    AND avatar_url IS DISTINCT FROM NEW.avatar_url;
  RETURN NEW;
END;
$$;

CREATE TRIGGER arsc_verified_identity_guard
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.protect_verified_arsc_identity_fields();

CREATE TRIGGER arsc_shared_avatar_sync
AFTER UPDATE OF avatar_url ON public.users
FOR EACH ROW EXECUTE FUNCTION public.sync_halo_avatar_to_leaderboard();

CREATE FUNCTION public.protect_verified_leaderboard_identity_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_member_id uuid;
  v_name text;
  v_unit text;
BEGIN
  SELECT i.member_id, m.canonical_name, l.unit
  INTO v_member_id, v_name, v_unit
  FROM public.arsc_identities i
  INNER JOIN public.members m ON m.id = i.member_id
  INNER JOIN public.member_release_links l
    ON l.member_id = i.member_id
   AND l.release_code = i.verified_release_code
   AND l.release_member_code = i.verified_release_member_code
  WHERE i.auth_user_id = NEW.user_id;

  IF FOUND THEN
    NEW.member_id := v_member_id;
    NEW.full_name := v_name;
    NEW.bidang_biro := CASE upper(v_unit)
      WHEN 'KETUM' THEN 'Ketua Umum (KETUM)'
      WHEN 'KETUA UMUM' THEN 'Ketua Umum (KETUM)'
      WHEN 'PSDM' THEN 'Biro Pengembangan Sumber Daya Mahasiswa (PSDM)'
      WHEN 'ADKEU' THEN 'Biro Administrasi dan Keuangan (ADKEU)'
      WHEN 'PENKOM' THEN 'Bidang Kepenulisan dan Kompetisi (PENKOM)'
      WHEN 'RISTEK' THEN 'Bidang Riset dan Teknologi (RISTEK)'
      WHEN 'INFOKOM' THEN 'Bidang Informasi dan Komunikasi (INFOKOM)'
      ELSE NEW.bidang_biro
    END;
    NEW.link_status := 'linked_exact';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER arsc_verified_profile_guard
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_verified_leaderboard_identity_fields();

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
    COALESCE(u.avatar_url, p.avatar_url) AS avatar_url,
    count(pl.id)::integer AS total_participation_count,
    max(COALESCE(pl.verified_at, pl.created_at)) AS last_activity_at,
    p.created_at,
    true AS is_identity_verified
  FROM public.profiles p
  INNER JOIN public.arsc_identities i
    ON i.auth_user_id = p.user_id
   AND i.member_id = p.member_id
  LEFT JOIN public.users u ON u.id = p.user_id
  LEFT JOIN public.participation_logs pl
    ON pl.profile_id = p.id
   AND pl.status = 'approved'
  WHERE p.link_status IN ('linked_exact', 'manually_linked')
  GROUP BY p.id, p.full_name, p.bidang_biro, p.avatar_url, u.avatar_url, p.created_at
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
  INNER JOIN public.profiles p ON p.id = pl.profile_id
  INNER JOIN public.arsc_identities i
    ON i.auth_user_id = p.user_id
   AND i.member_id = p.member_id
  WHERE pl.profile_id = p_profile_id
    AND pl.status = 'approved'
    AND p.link_status IN ('linked_exact', 'manually_linked')
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
  INNER JOIN public.profiles p ON p.id = pl.profile_id
  INNER JOIN public.arsc_identities i
    ON i.auth_user_id = p.user_id
   AND i.member_id = p.member_id
  WHERE pl.status = 'approved'
    AND c.category = p_category
    AND p.link_status IN ('linked_exact', 'manually_linked')
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

CREATE FUNCTION public.link_arsc_account_from_reference(
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
  v_profile_exists boolean := false;
  v_member_id uuid;
  v_member_count integer;
  v_bidang_biro text;
  v_unit_code text;
  v_position_code text;
  v_normalized_name text;
  v_email text;
  v_halo_avatar text;
BEGIN
  IF p_user_id IS NULL
    OR NULLIF(btrim(p_release_member_code), '') IS NULL
    OR NULLIF(btrim(p_release_code), '') IS NULL
    OR NULLIF(btrim(p_canonical_name), '') IS NULL
    OR NULLIF(btrim(p_unit), '') IS NULL
  THEN
    RAISE EXCEPTION 'Incomplete Rapor identity reference';
  END IF;

  SELECT u.email::text
  INTO v_email
  FROM auth.users u
  WHERE u.id = p_user_id;

  IF NOT FOUND OR NULLIF(v_email, '') IS NULL THEN
    RAISE EXCEPTION 'Supabase Auth account not found';
  END IF;

  v_unit_code := CASE upper(btrim(p_unit))
    WHEN 'KETUA UMUM' THEN 'KETUM'
    ELSE upper(btrim(p_unit))
  END;

  v_bidang_biro := CASE v_unit_code
    WHEN 'KETUM' THEN 'Ketua Umum (KETUM)'
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

  v_position_code := CASE
    WHEN upper(COALESCE(p_position, '')) LIKE '%PENGURUS%HARIAN%' THEN 'PENGURUS_HARIAN'
    WHEN upper(COALESCE(p_position, '')) LIKE '%STAF%AHLI%' THEN 'STAF_AHLI'
    WHEN upper(COALESCE(p_position, '')) LIKE '%STAF%' THEN 'STAF'
    WHEN upper(COALESCE(p_position, '')) LIKE '%ANGGOTA%MUDA%' THEN 'ANGGOTA_MUDA'
    ELSE 'ANGGOTA_MUDA'
  END;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('user:' || p_user_id::text, 0)
  );
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
      v_unit_code,
      NULLIF(btrim(p_position), ''),
      'verified_by_access_code'
    );
  ELSE
    UPDATE public.member_release_links
    SET
      unit = v_unit_code,
      position = NULLIF(btrim(p_position), ''),
      evaluation_status = 'verified_by_access_code',
      updated_at = now()
    WHERE release_code = btrim(p_release_code)
      AND release_member_code = btrim(p_release_member_code);
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('member:' || v_member_id::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.arsc_identities i
    WHERE i.member_id = v_member_id
      AND i.auth_user_id IS DISTINCT FROM p_user_id
  ) THEN
    RAISE EXCEPTION 'Rapor identity is already linked to another account';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.arsc_identities i
    WHERE i.auth_user_id = p_user_id
      AND i.member_id IS DISTINCT FROM v_member_id
  ) THEN
    RAISE EXCEPTION 'Account is already linked to a different Rapor identity';
  END IF;

  SELECT p.*
  INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = p_user_id
  FOR UPDATE;
  v_profile_exists := FOUND;

  IF v_profile_exists
    AND v_profile.member_id IS NOT NULL
    AND v_profile.member_id IS DISTINCT FROM v_member_id
    AND v_profile.link_status IN ('linked_exact', 'manually_linked')
  THEN
    RAISE EXCEPTION 'Leaderboard profile is already linked to a different Rapor identity';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.member_id = v_member_id
      AND p.user_id IS DISTINCT FROM p_user_id
  ) THEN
    RAISE EXCEPTION 'Rapor identity is already linked to another Leaderboard profile';
  END IF;

  UPDATE public.members
  SET canonical_name = btrim(p_canonical_name), updated_at = now()
  WHERE id = v_member_id;

  INSERT INTO public.arsc_identities (
    auth_user_id,
    member_id,
    verified_release_code,
    verified_release_member_code,
    verification_source,
    verified_at
  )
  VALUES (
    p_user_id,
    v_member_id,
    btrim(p_release_code),
    btrim(p_release_member_code),
    'rapor_access_code',
    now()
  )
  ON CONFLICT (auth_user_id) DO UPDATE
  SET
    member_id = EXCLUDED.member_id,
    verified_release_code = EXCLUDED.verified_release_code,
    verified_release_member_code = EXCLUDED.verified_release_member_code,
    verification_source = EXCLUDED.verification_source,
    verified_at = now(),
    updated_at = now();

  SELECT u.avatar_url
  INTO v_halo_avatar
  FROM public.users u
  WHERE u.id = p_user_id;

  INSERT INTO public.users (
    id,
    name,
    email,
    biro,
    jabatan,
    role,
    avatar_url,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    btrim(p_canonical_name),
    v_email,
    v_unit_code,
    v_position_code,
    'MEMBER',
    v_halo_avatar,
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    biro = EXCLUDED.biro,
    jabatan = EXCLUDED.jabatan,
    updated_at = now();

  SELECT u.avatar_url
  INTO v_halo_avatar
  FROM public.users u
  WHERE u.id = p_user_id;

  INSERT INTO public.profiles (
    user_id,
    member_id,
    full_name,
    avatar_url,
    bidang_biro,
    link_status
  )
  VALUES (
    p_user_id,
    v_member_id,
    btrim(p_canonical_name),
    v_halo_avatar,
    v_bidang_biro,
    'linked_exact'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    member_id = EXCLUDED.member_id,
    full_name = EXCLUDED.full_name,
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    bidang_biro = EXCLUDED.bidang_biro,
    link_status = EXCLUDED.link_status,
    updated_at = now()
  RETURNING * INTO v_profile;

  RETURN jsonb_build_object(
    'profile_id', v_profile.id,
    'member_id', v_member_id,
    'auth_user_id', p_user_id,
    'full_name', btrim(p_canonical_name),
    'bidang_biro', v_bidang_biro,
    'link_status', 'linked_exact',
    'halo_profile_synced', true
  );
END;
$$;

CREATE FUNCTION public.get_my_arsc_identity()
RETURNS TABLE (
  auth_user_id uuid,
  member_id uuid,
  canonical_name text,
  unit text,
  "position" text,
  verification_source text,
  verified_at timestamptz,
  leaderboard_profile_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    i.auth_user_id,
    i.member_id,
    m.canonical_name,
    l.unit,
    l.position,
    i.verification_source,
    i.verified_at,
    p.id AS leaderboard_profile_id
  FROM public.arsc_identities i
  INNER JOIN public.members m ON m.id = i.member_id
  INNER JOIN public.member_release_links l
    ON l.member_id = i.member_id
   AND l.release_code = i.verified_release_code
   AND l.release_member_code = i.verified_release_member_code
  LEFT JOIN public.profiles p ON p.user_id = i.auth_user_id
  WHERE i.auth_user_id = auth.uid();
$$;

CREATE FUNCTION public.set_shared_profile_avatar(
  p_user_id uuid,
  p_avatar_url text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_halo_updated integer;
  v_leaderboard_updated integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  IF NULLIF(btrim(COALESCE(p_avatar_url, '')), '') IS NOT NULL
    AND p_avatar_url !~ '^https://'
  THEN
    RAISE EXCEPTION 'Avatar URL must use HTTPS';
  END IF;

  UPDATE public.users
  SET avatar_url = NULLIF(btrim(COALESCE(p_avatar_url, '')), ''), updated_at = now()
  WHERE id = p_user_id;
  GET DIAGNOSTICS v_halo_updated = ROW_COUNT;

  UPDATE public.profiles
  SET avatar_url = NULLIF(btrim(COALESCE(p_avatar_url, '')), ''), updated_at = now()
  WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_leaderboard_updated = ROW_COUNT;

  IF v_halo_updated = 0 AND v_leaderboard_updated = 0 THEN
    RAISE EXCEPTION 'Shared profile not found';
  END IF;

  RETURN jsonb_build_object(
    'auth_user_id', p_user_id,
    'avatar_url', NULLIF(btrim(COALESCE(p_avatar_url, '')), ''),
    'halo_profile_updated', v_halo_updated > 0,
    'leaderboard_profile_updated', v_leaderboard_updated > 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_leaderboard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_member_participations(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_category_participation_counts(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_leaderboard_reference_member(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_arsc_account_from_reference(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_arsc_identity() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_shared_profile_avatar(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_verified_arsc_identity_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_verified_leaderboard_identity_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_halo_avatar_to_leaderboard() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_public_leaderboard() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_member_participations(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_category_participation_counts(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_leaderboard_reference_member(text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.link_arsc_account_from_reference(uuid, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_arsc_identity() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_shared_profile_avatar(uuid, text) TO service_role;

COMMIT;
