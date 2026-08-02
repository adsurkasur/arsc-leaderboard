-- Stage 4 identity and sanitized public read validation

BEGIN;

DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_profile_id uuid;
  v_member_id uuid;
  v_competition_id uuid := gen_random_uuid();
  v_pending_competition_id uuid := gen_random_uuid();
  v_link_result jsonb;
  v_public_count integer;
  v_category_count bigint;
BEGIN
  RAISE NOTICE '--- STARTING STAGE 4 IDENTITY VALIDATION ---';

  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'stage4_identity_test@arsc.org'
  );

  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Expected auth trigger to create a profile.';
  END IF;

  PERFORM public.upsert_leaderboard_reference_member(
    'RTP_2026_STAGE4_001',
    'RTP_2026',
    'Stage Four Member',
    'RISTEK',
    'Anggota Muda'
  );

  SELECT l.member_id INTO v_member_id
  FROM public.member_release_links l
  WHERE l.release_code = 'RTP_2026'
    AND l.release_member_code = 'RTP_2026_STAGE4_001';

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Reference synchronization did not create a stable member link.';
  END IF;

  v_link_result := public.link_leaderboard_profile_from_reference(
    v_user_id,
    'RTP_2026_STAGE4_001',
    'RTP_2026',
    'Stage Four Member',
    'RISTEK',
    'Anggota Muda'
  );

  IF v_link_result->>'link_status' IS DISTINCT FROM 'linked_exact' THEN
    RAISE EXCEPTION 'Expected linked_exact result, got %', v_link_result;
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
    RAISE EXCEPTION 'Profile identity was not synchronized from the Rapor reference.';
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
    AND is_identity_verified = true
    AND total_participation_count = 1;

  IF v_public_count <> 1 THEN
    RAISE EXCEPTION 'Sanitized public leaderboard did not return the linked profile.';
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
  RAISE NOTICE '--- STAGE 4 IDENTITY VALIDATION PASSED ---';
END;
$$;

ROLLBACK;
