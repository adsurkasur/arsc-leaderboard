-- Stage 5 configurable scoring integration validation.

BEGIN;

DO $$
DECLARE
  v_admin_id uuid := gen_random_uuid();
  v_member_user_id uuid := gen_random_uuid();
  v_member_id uuid;
  v_profile_id uuid;
  v_national_template_id uuid;
  v_pkm_template_id uuid;
  v_competition_id uuid;
  v_zero_competition_id uuid;
  v_rule_id uuid;
  v_zero_rule_id uuid;
  v_other_rule_id uuid;
  v_log_id uuid;
  v_zero_log_id uuid;
  v_result jsonb;
  v_count integer;
  v_points bigint;
  v_schema_hash_before text;
  v_schema_hash_after text;
  v_unauthorized_blocked boolean := false;
  v_wrong_rule_blocked boolean := false;
BEGIN
  RAISE NOTICE '--- STARTING STAGE 5 CONFIGURABLE SCORING VALIDATION ---';

  SELECT md5(string_agg(
    table_name || ':' || column_name || ':' || data_type || ':' || is_nullable,
    ',' ORDER BY table_name, ordinal_position
  ))
  INTO v_schema_hash_before
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('rapor_members', 'rapor_releases', 'rapor_access_codes', 'users');

  SELECT id INTO v_national_template_id
  FROM public.leaderboard_scoring_templates
  WHERE code = 'nasional';

  SELECT id INTO v_pkm_template_id
  FROM public.leaderboard_scoring_templates
  WHERE code = 'pkm';

  IF v_national_template_id IS NULL OR v_pkm_template_id IS NULL THEN
    RAISE EXCEPTION 'Required national and PKM templates were not seeded';
  END IF;

  IF (
    SELECT count(*)
    FROM (
      SELECT template.code
      FROM public.leaderboard_scoring_templates template
      JOIN public.leaderboard_scoring_template_rules rule ON rule.template_id = template.id
      WHERE template.code IN ('internal-ub', 'regional', 'nasional', 'internasional', 'umum')
      GROUP BY template.code
      HAVING count(*) = 10
    ) complete_template
  ) <> 5 THEN
    RAISE EXCEPTION 'Every standard scoring template must contain 10 complete placement options';
  END IF;

  IF (
    SELECT count(*)
    FROM public.leaderboard_scoring_template_rules
    WHERE template_id = v_national_template_id
  ) <> 10 THEN
    RAISE EXCEPTION 'National template must contain 10 complete placement options';
  END IF;

  IF (
    SELECT count(*)
    FROM public.leaderboard_scoring_template_rules
    WHERE template_id = v_national_template_id
      AND label IN ('Juara Harapan 1', 'Juara Harapan 2', 'Juara Harapan 3')
  ) <> 3 THEN
    RAISE EXCEPTION 'National template must contain Harapan 1, 2, and 3';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.leaderboard_scoring_template_rules
    WHERE template_id = v_pkm_template_id
      AND label = 'Lolos Seleksi Internal UB'
      AND points = 10
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.leaderboard_scoring_template_rules
    WHERE template_id = v_pkm_template_id
      AND label = 'Lolos Pendanaan'
      AND points = 35
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.leaderboard_scoring_template_rules
    WHERE template_id = v_pkm_template_id
      AND label = 'Finalis PIMNAS'
      AND points = 60
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.leaderboard_scoring_template_rules
    WHERE template_id = v_pkm_template_id
      AND label = 'Medali Emas PIMNAS'
      AND points = 100
  ) THEN
    RAISE EXCEPTION 'PKM template is incomplete';
  END IF;

  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES
    (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'stage5_admin@arsc.org'
    ),
    (
      v_member_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'stage5_member@arsc.org'
    );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_admin_id, 'admin');

  PERFORM public.upsert_leaderboard_reference_member(
    'RTP_2026_STAGE5_001',
    'RTP_2026',
    'Stage Five Member',
    'RISTEK',
    'Staf Ahli'
  );

  PERFORM public.link_arsc_account_from_reference(
    v_member_user_id,
    'RTP_2026_STAGE5_001',
    'RTP_2026',
    'Stage Five Member',
    'RISTEK',
    'Staf Ahli'
  );

  SELECT p.id, p.member_id
  INTO v_profile_id, v_member_id
  FROM public.profiles p
  WHERE p.user_id = v_member_user_id;

  IF v_profile_id IS NULL OR v_member_id IS NULL THEN
    RAISE EXCEPTION 'Stage 5 member identity setup failed';
  END IF;

  PERFORM set_config('request.jwt.claims', '{"sub":"' || v_admin_id || '"}', true);

  v_result := public.leaderboard_save_competition(
    NULL,
    'National Stage 5 Test',
    current_date,
    'Preset copy test',
    'Nasional',
    true,
    v_national_template_id,
    NULL
  );
  v_competition_id := (v_result->>'competition_id')::uuid;

  SELECT count(*) INTO v_count
  FROM public.leaderboard_competition_scoring_rules
  WHERE competition_id = v_competition_id
    AND is_active = true;

  IF v_count <> 10 THEN
    RAISE EXCEPTION 'National preset should create 10 active rules, found %', v_count;
  END IF;

  SELECT id INTO v_rule_id
  FROM public.leaderboard_competition_scoring_rules
  WHERE competition_id = v_competition_id
    AND label = 'Juara 1'
    AND points = 50;

  SELECT id INTO v_other_rule_id
  FROM public.leaderboard_competition_scoring_rules
  WHERE competition_id = v_competition_id
    AND label = 'Juara 2';

  -- Editing keeps the competition identity, updates selected rule IDs in place,
  -- and deactivates omitted rules instead of deleting historical definitions.
  v_result := public.leaderboard_save_competition(
    v_competition_id,
    'National Stage 5 Test - Edited',
    current_date,
    'Customized scoring test',
    'Nasional',
    true,
    v_national_template_id,
    jsonb_build_array(
      jsonb_build_object(
        'id', v_rule_id,
        'label', 'Juara 1 Utama',
        'points', 55,
        'sort_order', 10
      ),
      jsonb_build_object(
        'id', v_other_rule_id,
        'label', 'Juara 2',
        'points', 44,
        'sort_order', 20
      )
    )
  );

  IF (v_result->>'competition_id')::uuid IS DISTINCT FROM v_competition_id
    OR (v_result->>'rule_count')::integer IS DISTINCT FROM 2
    OR NOT EXISTS (
      SELECT 1
      FROM public.competitions
      WHERE id = v_competition_id
        AND title = 'National Stage 5 Test - Edited'
        AND is_active = true
    )
    OR NOT EXISTS (
      SELECT 1
      FROM public.leaderboard_competition_scoring_rules
      WHERE id = v_rule_id
        AND competition_id = v_competition_id
        AND label = 'Juara 1 Utama'
        AND points = 55
        AND is_active = true
    )
    OR (
      SELECT count(*)
      FROM public.leaderboard_competition_scoring_rules
      WHERE competition_id = v_competition_id
        AND is_active = true
    ) <> 2
  THEN
    RAISE EXCEPTION 'Competition scoring edit did not persist safely';
  END IF;

  v_result := public.leaderboard_save_competition(
    NULL,
    'Zero Point Stage 5 Test',
    current_date,
    'Custom rule test',
    'Kustom',
    true,
    NULL,
    '[{"label":"Tercatat","points":0,"sort_order":10}]'::jsonb
  );
  v_zero_competition_id := (v_result->>'competition_id')::uuid;

  SELECT id INTO v_zero_rule_id
  FROM public.leaderboard_competition_scoring_rules
  WHERE competition_id = v_zero_competition_id
    AND label = 'Tercatat';

  PERFORM set_config('request.jwt.claims', '{"sub":"' || v_member_user_id || '"}', true);

  BEGIN
    PERFORM public.leaderboard_save_competition(
      NULL,
      'Unauthorized Competition',
      current_date,
      NULL,
      'Umum',
      true,
      v_national_template_id,
      NULL
    );
  EXCEPTION WHEN OTHERS THEN
    v_unauthorized_blocked := SQLERRM = 'Not authorized';
  END;

  IF NOT v_unauthorized_blocked THEN
    RAISE EXCEPTION 'A non-admin was able to manage competitions';
  END IF;

  BEGIN
    PERFORM public.submit_participation_v2(
      v_zero_competition_id,
      v_other_rule_id,
      'https://example.com/wrong-rule'
    );
  EXCEPTION WHEN OTHERS THEN
    v_wrong_rule_blocked := SQLERRM = 'Scoring option is not available for this competition';
  END;

  IF NOT v_wrong_rule_blocked THEN
    RAISE EXCEPTION 'A scoring rule from another competition was accepted';
  END IF;

  v_result := public.submit_participation_v2(
    v_competition_id,
    v_rule_id,
    'https://example.com/national-proof'
  );
  v_log_id := (v_result->>'log_id')::uuid;

  IF NOT EXISTS (
    SELECT 1
    FROM public.participation_logs
    WHERE id = v_log_id
      AND status = 'pending'
      AND requested_scoring_rule_id = v_rule_id
      AND requested_achievement = 'Juara 1 Utama'
      AND requested_points = 55
      AND awarded_achievement IS NULL
      AND awarded_points IS NULL
  ) THEN
    RAISE EXCEPTION 'Submission did not preserve the requested scoring snapshot';
  END IF;

  v_result := public.submit_participation_v2(
    v_zero_competition_id,
    v_zero_rule_id,
    'https://example.com/zero-proof'
  );
  v_zero_log_id := (v_result->>'log_id')::uuid;

  PERFORM set_config('request.jwt.claims', '{"sub":"' || v_admin_id || '"}', true);

  v_result := public.review_participation_v2(v_log_id, 'approved', v_rule_id, 'Verified');
  IF (v_result->>'awarded_points')::integer IS DISTINCT FROM 55 THEN
    RAISE EXCEPTION 'Configured national score was not applied';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.participation_logs
    WHERE id = v_log_id
      AND awarded_scoring_rule_id = v_rule_id
      AND awarded_achievement = 'Juara 1 Utama'
      AND awarded_points = 55
  ) THEN
    RAISE EXCEPTION 'Review did not preserve the awarded scoring snapshot';
  END IF;

  v_result := public.review_participation_v2(v_zero_log_id, 'approved', v_zero_rule_id, NULL);
  IF (v_result->>'awarded_points')::integer IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Configured zero-point score was not preserved';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.participation_submission_events
    WHERE log_id = v_log_id
      AND to_status = 'approved'
      AND scoring_rule_id = v_rule_id
      AND achievement = 'Juara 1 Utama'
      AND awarded_points = 55
  ) THEN
    RAISE EXCEPTION 'Review audit event did not preserve the scoring snapshot';
  END IF;

  SELECT total_points INTO v_points
  FROM public.get_public_leaderboard_v2()
  WHERE profile_id = v_profile_id;

  IF v_points IS DISTINCT FROM 55 THEN
    RAISE EXCEPTION 'Public leaderboard should total 55 points, got %', v_points;
  END IF;

  SELECT total_points INTO v_points
  FROM public.get_public_category_scores_v2('Nasional')
  WHERE profile_id = v_profile_id;

  IF v_points IS DISTINCT FROM 55 THEN
    RAISE EXCEPTION 'Category leaderboard should total 55 points, got %', v_points;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.get_public_member_participations_v2(v_profile_id)
    WHERE participation_id = v_log_id
      AND achievement = 'Juara 1 Utama'
      AND awarded_points = 55
  ) THEN
    RAISE EXCEPTION 'Public participation detail did not include achievement and points';
  END IF;

  IF has_table_privilege('authenticated', 'public.competitions', 'INSERT')
    OR has_table_privilege('authenticated', 'public.competitions', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.competitions', 'DELETE')
  THEN
    RAISE EXCEPTION 'Direct authenticated competition mutations remain available';
  END IF;

  IF has_table_privilege('authenticated', 'public.leaderboard_competition_scoring_rules', 'INSERT')
    OR has_table_privilege('authenticated', 'public.leaderboard_competition_scoring_rules', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.leaderboard_competition_scoring_rules', 'DELETE')
  THEN
    RAISE EXCEPTION 'Direct authenticated scoring-rule mutations remain available';
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
    RAISE EXCEPTION 'A protected Rapor/Halo table schema changed during Stage 5 validation';
  END IF;

  RAISE NOTICE 'Stage 5 presets, custom rules, authorization, scoring, ranking, and protected boundaries passed.';
  RAISE NOTICE '--- ALL STAGE 5 TESTS PASSED ---';
END;
$$;

ROLLBACK;
