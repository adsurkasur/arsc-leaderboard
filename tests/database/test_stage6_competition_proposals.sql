-- Stage 6 competition proposals and tracks integration validation.

BEGIN;

DO $$
DECLARE
  v_admin_id uuid := gen_random_uuid();
  v_member_user_id uuid := gen_random_uuid();
  v_profile_id uuid;
  v_internal_template_id uuid;
  v_competition_id uuid;
  v_track_a_id uuid;
  v_track_b_id uuid;
  v_rule_id uuid;
  v_log_a_id uuid;
  v_log_b_id uuid;
  v_proposal_id uuid;
  v_proposal_two_id uuid;
  v_result jsonb;
  v_duplicate_blocked boolean := false;
  v_schema_hash_before text;
  v_schema_hash_after text;
BEGIN
  RAISE NOTICE '--- STARTING STAGE 6 COMPETITION PROPOSAL VALIDATION ---';

  SELECT md5(string_agg(
    table_name || ':' || column_name || ':' || data_type || ':' || is_nullable,
    ',' ORDER BY table_name, ordinal_position
  ))
  INTO v_schema_hash_before
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('rapor_members', 'rapor_releases', 'rapor_access_codes', 'users');

  SELECT id INTO v_internal_template_id
  FROM public.leaderboard_scoring_templates
  WHERE code = 'internal-arsc';

  IF v_internal_template_id IS NULL
    OR (
      SELECT count(*)
      FROM public.leaderboard_scoring_template_rules
      WHERE template_id = v_internal_template_id
        AND (label, points) IN (
          ('Juara 1', 15),
          ('Juara 2', 12),
          ('Juara 3', 10),
          ('Finalis', 6),
          ('Peserta', 2)
        )
    ) <> 5
  THEN
    RAISE EXCEPTION 'Internal ARSC preset is incomplete';
  END IF;

  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES
    (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'stage6_admin@arsc.org'
    ),
    (
      v_member_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'stage6_member@arsc.org'
    );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_admin_id, 'admin');

  PERFORM public.upsert_leaderboard_reference_member(
    'RTP_2026_STAGE6_001',
    'RTP_2026',
    'Stage Six Member',
    'RISTEK',
    'Staf Ahli'
  );

  PERFORM public.link_arsc_account_from_reference(
    v_member_user_id,
    'RTP_2026_STAGE6_001',
    'RTP_2026',
    'Stage Six Member',
    'RISTEK',
    'Staf Ahli'
  );

  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = v_member_user_id;

  PERFORM set_config('request.jwt.claims', '{"sub":"' || v_admin_id || '"}', true);

  v_result := public.leaderboard_save_competition_v2(
    NULL,
    'Multi-track Stage 6 Test',
    current_date,
    'One event with multiple categories',
    'Nasional',
    true,
    v_internal_template_id,
    NULL,
    '[{"name":"UI/UX Design"},{"name":"Data Mining"}]'::jsonb
  );
  v_competition_id := (v_result->>'competition_id')::uuid;

  SELECT id INTO v_track_a_id
  FROM public.leaderboard_competition_tracks
  WHERE competition_id = v_competition_id AND name = 'UI/UX Design';

  SELECT id INTO v_track_b_id
  FROM public.leaderboard_competition_tracks
  WHERE competition_id = v_competition_id AND name = 'Data Mining';

  SELECT id INTO v_rule_id
  FROM public.leaderboard_competition_scoring_rules
  WHERE competition_id = v_competition_id AND label = 'Juara 1';

  IF v_track_a_id IS NULL OR v_track_b_id IS NULL OR v_rule_id IS NULL THEN
    RAISE EXCEPTION 'Competition tracks or scoring rules were not created';
  END IF;

  PERFORM set_config('request.jwt.claims', '{"sub":"' || v_member_user_id || '"}', true);

  v_result := public.submit_participation_v3(
    v_competition_id,
    v_track_a_id,
    v_rule_id,
    'https://example.com/uiux-proof'
  );
  v_log_a_id := (v_result->>'log_id')::uuid;

  v_result := public.submit_participation_v3(
    v_competition_id,
    v_track_b_id,
    v_rule_id,
    'https://example.com/data-mining-proof'
  );
  v_log_b_id := (v_result->>'log_id')::uuid;

  IF v_log_a_id IS NULL OR v_log_b_id IS NULL OR v_log_a_id = v_log_b_id THEN
    RAISE EXCEPTION 'One member could not submit separate tracks in the same event';
  END IF;

  BEGIN
    PERFORM public.submit_participation_v3(
      v_competition_id,
      v_track_a_id,
      v_rule_id,
      'https://example.com/duplicate-proof'
    );
  EXCEPTION WHEN OTHERS THEN
    v_duplicate_blocked := SQLERRM = 'Submission is already pending or approved for this competition track';
  END;

  IF NOT v_duplicate_blocked THEN
    RAISE EXCEPTION 'Duplicate active submission for one competition track was not blocked';
  END IF;

  v_result := public.submit_competition_proposal(
    'ARSC Innovation Challenge',
    'ARSC Universitas Brawijaya',
    'https://example.com/arsc-innovation',
    current_date,
    'Internal ARSC',
    'Poster Digital',
    'Finalis',
    'https://example.com/finalist-proof',
    'Mohon ditambahkan ke katalog.'
  );
  v_proposal_id := (v_result->>'proposal_id')::uuid;

  IF NOT EXISTS (
    SELECT 1
    FROM public.leaderboard_competition_proposals
    WHERE id = v_proposal_id
      AND status = 'pending'
      AND proposed_track_name = 'Poster Digital'
  ) THEN
    RAISE EXCEPTION 'Member proposal was not stored safely';
  END IF;

  PERFORM set_config('request.jwt.claims', '{"sub":"' || v_admin_id || '"}', true);

  v_result := public.review_competition_proposal(
    v_proposal_id,
    'accepted',
    'Informasi resmi dan bukti sesuai.',
    NULL,
    'ARSC Innovation Challenge',
    current_date,
    'Lomba wajib internal ARSC',
    'Internal ARSC',
    true,
    v_internal_template_id,
    NULL,
    '[{"name":"Poster Digital"}]'::jsonb,
    NULL,
    'Poster Digital',
    'Finalis'
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.leaderboard_competition_proposals proposal
    JOIN public.participation_logs log ON log.id = proposal.participation_log_id
    JOIN public.leaderboard_competition_tracks track ON track.id = log.competition_track_id
    WHERE proposal.id = v_proposal_id
      AND proposal.status = 'accepted'
      AND proposal.resolution_type = 'created_competition'
      AND log.status = 'pending'
      AND log.requested_achievement = 'Finalis'
      AND log.requested_points = 6
      AND track.name = 'Poster Digital'
  ) THEN
    RAISE EXCEPTION 'Accepted proposal did not create the competition and pending participation atomically';
  END IF;

  PERFORM set_config('request.jwt.claims', '{"sub":"' || v_member_user_id || '"}', true);

  v_result := public.submit_competition_proposal(
    'Need More Info Test',
    'Example Organizer',
    'https://example.com/need-info',
    current_date,
    'Regional',
    'Umum',
    'Peserta',
    'https://example.com/need-info-proof',
    NULL
  );
  v_proposal_two_id := (v_result->>'proposal_id')::uuid;

  PERFORM set_config('request.jwt.claims', '{"sub":"' || v_admin_id || '"}', true);
  PERFORM public.review_competition_proposal(
    v_proposal_two_id,
    'needs_info',
    'Tambahkan sumber penyelenggara yang lebih spesifik.',
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
  );

  PERFORM set_config('request.jwt.claims', '{"sub":"' || v_member_user_id || '"}', true);
  v_result := public.submit_competition_proposal(
    'Need More Info Test',
    'Example Organizer Updated',
    'https://example.com/need-info-updated',
    current_date,
    'Regional',
    'Umum',
    'Peserta',
    'https://example.com/need-info-proof-updated',
    'Informasi telah dilengkapi.'
  );

  IF (v_result->>'proposal_id')::uuid IS DISTINCT FROM v_proposal_two_id
    OR (v_result->>'action') IS DISTINCT FROM 'resubmitted'
    OR NOT EXISTS (
      SELECT 1
      FROM public.leaderboard_competition_proposals
      WHERE id = v_proposal_two_id
        AND status = 'pending'
        AND proposed_organizer = 'Example Organizer Updated'
        AND review_notes IS NULL
    )
  THEN
    RAISE EXCEPTION 'Needs-info proposal was not resubmitted safely';
  END IF;

  PERFORM set_config('request.jwt.claims', '{"sub":"' || v_admin_id || '"}', true);
  PERFORM public.review_participation_v2(v_log_a_id, 'approved', v_rule_id, 'Verified');

  IF NOT EXISTS (
    SELECT 1
    FROM public.get_public_member_participations_v3(v_profile_id)
    WHERE participation_id = v_log_a_id
      AND competition_track_name = 'UI/UX Design'
      AND achievement = 'Juara 1'
      AND awarded_points = 15
  ) THEN
    RAISE EXCEPTION 'Public participation detail did not include the competition track';
  END IF;

  IF has_table_privilege('authenticated', 'public.leaderboard_competition_tracks', 'INSERT')
    OR has_table_privilege('authenticated', 'public.leaderboard_competition_tracks', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.leaderboard_competition_tracks', 'DELETE')
    OR has_table_privilege('authenticated', 'public.leaderboard_competition_proposals', 'INSERT')
    OR has_table_privilege('authenticated', 'public.leaderboard_competition_proposals', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.leaderboard_competition_proposals', 'DELETE')
  THEN
    RAISE EXCEPTION 'Direct authenticated Stage 6 mutations remain available';
  END IF;

  SELECT md5(string_agg(
    table_name || ':' || column_name || ':' || data_type || ':' || is_nullable,
    ',' ORDER BY table_name, ordinal_position
  ))
  INTO v_schema_hash_after
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('rapor_members', 'rapor_releases', 'rapor_access_codes', 'users');

  IF v_schema_hash_after IS DISTINCT FROM v_schema_hash_before THEN
    RAISE EXCEPTION 'A protected Rapor/Halo table schema changed during Stage 6 validation';
  END IF;

  RAISE NOTICE 'Stage 6 tracks, proposals, Internal ARSC preset, and protected boundaries passed.';
  RAISE NOTICE '--- ALL STAGE 6 TESTS PASSED ---';
END;
$$;

ROLLBACK;
