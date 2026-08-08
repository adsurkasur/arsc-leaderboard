-- Stage 4 shared identity and sanitized public-read validation.

BEGIN;

DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_second_user_id uuid := gen_random_uuid();
  v_profile_id uuid;
  v_member_id uuid;
  v_competition_id uuid := gen_random_uuid();
  v_pending_competition_id uuid := gen_random_uuid();
  v_link_result jsonb;
  v_public_count integer;
  v_category_count bigint;
  v_duplicate_blocked boolean := false;
BEGIN
  RAISE NOTICE '--- STARTING STAGE 4 SHARED IDENTITY VALIDATION ---';

  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
  VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'stage4_identity_test@arsc.org',
    '{"full_name":"Pre-verification Name"}'::jsonb
  );

  PERFORM public.upsert_leaderboard_reference_member(
    'RTP_2026_STAGE4_001',
    'RTP_2026',
    'Stage Four Member',
    'RISTEK',
    'Staf Ahli'
  );

  SELECT l.member_id INTO v_member_id
  FROM public.member_release_links l
  WHERE l.release_code = 'RTP_2026'
    AND l.release_member_code = 'RTP_2026_STAGE4_001';

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Reference synchronization did not create a stable member link.';
  END IF;

  v_link_result := public.link_arsc_account_from_reference(
    v_user_id,
    'RTP_2026_STAGE4_001',
    'RTP_2026',
    'Stage Four Member',
    'RISTEK',
    'Staf Ahli'
  );

  IF v_link_result->>'link_status' IS DISTINCT FROM 'linked_exact'
    OR (v_link_result->>'halo_profile_synced')::boolean IS DISTINCT FROM true
  THEN
    RAISE EXCEPTION 'Expected synchronized linked_exact result, got %', v_link_result;
  END IF;

  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.arsc_identities i
    WHERE i.auth_user_id = v_user_id
      AND i.member_id = v_member_id
      AND i.verified_release_code = 'RTP_2026'
      AND i.verified_release_member_code = 'RTP_2026_STAGE4_001'
  ) THEN
    RAISE EXCEPTION 'Canonical shared identity link was not recorded.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_profile_id
      AND p.member_id = v_member_id
      AND p.full_name = 'Stage Four Member'
      AND p.bidang_biro = 'Bidang Riset dan Teknologi (RISTEK)'
      AND p.link_status = 'linked_exact'
  ) THEN
    RAISE EXCEPTION 'Leaderboard profile was not synchronized from Rapor.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = v_user_id
      AND u.name = 'Stage Four Member'
      AND u.email = 'stage4_identity_test@arsc.org'
      AND u.biro = 'RISTEK'
      AND u.jabatan = 'STAF_AHLI'
  ) THEN
    RAISE EXCEPTION 'Halo PSDM profile was not synchronized from Rapor/Auth.';
  END IF;

  UPDATE public.users
  SET name = 'Drifted Name', biro = 'INFOKOM', jabatan = 'ANGGOTA_MUDA'
  WHERE id = v_user_id;

  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_user_id
      AND (name IS DISTINCT FROM 'Stage Four Member' OR biro IS DISTINCT FROM 'RISTEK' OR jabatan IS DISTINCT FROM 'STAF_AHLI')
  ) THEN
    RAISE EXCEPTION 'Verified Halo identity fields were allowed to drift.';
  END IF;

  UPDATE public.profiles
  SET
    member_id = NULL,
    full_name = 'Drifted Leaderboard Name',
    bidang_biro = 'Bidang Informasi dan Komunikasi (INFOKOM)',
    link_status = 'unmatched'
  WHERE id = v_profile_id;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_profile_id
      AND (
        member_id IS DISTINCT FROM v_member_id
        OR full_name IS DISTINCT FROM 'Stage Four Member'
        OR bidang_biro IS DISTINCT FROM 'Bidang Riset dan Teknologi (RISTEK)'
        OR link_status IS DISTINCT FROM 'linked_exact'
      )
  ) THEN
    RAISE EXCEPTION 'Verified Leaderboard identity fields were allowed to drift.';
  END IF;

  PERFORM public.set_shared_profile_avatar(v_user_id, 'https://example.com/shared-avatar.webp');

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    INNER JOIN public.profiles p ON p.user_id = u.id
    WHERE u.id = v_user_id
      AND u.avatar_url = 'https://example.com/shared-avatar.webp'
      AND p.avatar_url = u.avatar_url
  ) THEN
    RAISE EXCEPTION 'Shared avatar did not synchronize across Halo and Leaderboard.';
  END IF;

  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (
    v_second_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'stage4_duplicate_test@arsc.org'
  );

  BEGIN
    PERFORM public.link_arsc_account_from_reference(
      v_second_user_id,
      'RTP_2026_STAGE4_001',
      'RTP_2026',
      'Stage Four Member',
      'RISTEK',
      'Staf Ahli'
    );
  EXCEPTION WHEN OTHERS THEN
    v_duplicate_blocked := SQLERRM LIKE '%already linked%';
  END;

  IF NOT v_duplicate_blocked THEN
    RAISE EXCEPTION 'A second account was able to claim the same Rapor identity.';
  END IF;

  INSERT INTO public.competitions (id, title, date, category)
  VALUES
    (v_competition_id, 'Stage 4 Competition', current_date, 'Riset'),
    (v_pending_competition_id, 'Stage 4 Pending Competition', current_date, 'Riset');

  INSERT INTO public.participation_logs (
    profile_id,
    competition_id,
    evidence_url,
    status,
    awarded_points
  )
  VALUES (
    v_profile_id,
    v_competition_id,
    'https://example.com/stage4-proof',
    'approved',
    0
  );

  INSERT INTO public.participation_logs (
    profile_id,
    competition_id,
    evidence_url,
    status
  )
  VALUES (
    v_profile_id,
    v_pending_competition_id,
    'https://example.com/stage4-pending-proof',
    'pending'
  );

  SET LOCAL ROLE anon;

  SELECT count(*) INTO v_public_count
  FROM public.get_public_leaderboard()
  WHERE profile_id = v_profile_id
    AND full_name = 'Stage Four Member'
    AND avatar_url = 'https://example.com/shared-avatar.webp'
    AND is_identity_verified = true
    AND total_participation_count = 1;

  IF v_public_count <> 1 THEN
    RAISE EXCEPTION 'Sanitized public leaderboard did not return the shared identity.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.get_public_member_participations(v_profile_id)
    WHERE competition_id = v_competition_id
  ) THEN
    RAISE EXCEPTION 'Approved public participation was not returned.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.get_public_member_participations(v_profile_id)
    WHERE competition_id = v_pending_competition_id
  ) THEN
    RAISE EXCEPTION 'Pending participation leaked through the public read contract.';
  END IF;

  SELECT participation_count INTO v_category_count
  FROM public.get_public_category_participation_counts('Riset')
  WHERE profile_id = v_profile_id;

  IF v_category_count <> 1 THEN
    RAISE EXCEPTION 'Category participation count mismatch.';
  END IF;

  RESET ROLE;
  RAISE NOTICE '--- STAGE 4 SHARED IDENTITY VALIDATION PASSED ---';
END;
$$;

ROLLBACK;
