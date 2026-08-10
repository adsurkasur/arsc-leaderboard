-- Stage 7 messaging, notification, and guarded-delete integration validation.

BEGIN;

DO $$
DECLARE
  v_admin_id uuid := gen_random_uuid();
  v_member_user_id uuid := gen_random_uuid();
  v_profile_id uuid;
  v_template_id uuid;
  v_competition_id uuid;
  v_empty_competition_id uuid;
  v_track_id uuid;
  v_rule_id uuid;
  v_log_id uuid;
  v_proposal_id uuid;
  v_notification_id uuid;
  v_result jsonb;
  v_delete_blocked boolean := false;
  v_blank_rejection_blocked boolean := false;
  v_schema_hash_before text;
  v_schema_hash_after text;
BEGIN
  RAISE NOTICE '--- STARTING STAGE 7 OPERATIONS VALIDATION ---';

  SELECT md5(string_agg(
    table_name || ':' || column_name || ':' || data_type || ':' || is_nullable,
    ',' ORDER BY table_name, ordinal_position
  ))
  INTO v_schema_hash_before
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('rapor_members', 'rapor_releases', 'rapor_access_codes', 'users', 'arsc_identities');

  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES
    (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'stage7_admin@arsc.org'
    ),
    (
      v_member_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'stage7_member@arsc.org'
    );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_admin_id, 'admin');

  PERFORM public.upsert_leaderboard_reference_member(
    'RTP_2026_STAGE7_001',
    'RTP_2026',
    'Stage Seven Member',
    'RISTEK',
    'Staf Ahli'
  );

  PERFORM public.link_arsc_account_from_reference(
    v_member_user_id,
    'RTP_2026_STAGE7_001',
    'RTP_2026',
    'Stage Seven Member',
    'RISTEK',
    'Staf Ahli'
  );

  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = v_member_user_id;

  SELECT id INTO v_template_id
  FROM public.leaderboard_scoring_templates
  WHERE code = 'internal-arsc';

  PERFORM set_config('request.jwt.claims', '{"sub":"' || v_admin_id || '"}', true);

  v_result := public.leaderboard_save_competition_v2(
    NULL,
    'Stage 7 Protected Competition',
    current_date,
    'Used competition must never be deleted',
    'Internal ARSC',
    true,
    v_template_id,
    NULL,
    '[{"name":"Umum"}]'::jsonb
  );
  v_competition_id := (v_result->>'competition_id')::uuid;

  SELECT id INTO v_track_id
  FROM public.leaderboard_competition_tracks
  WHERE competition_id = v_competition_id AND name = 'Umum';

  SELECT id INTO v_rule_id
  FROM public.leaderboard_competition_scoring_rules
  WHERE competition_id = v_competition_id AND label = 'Peserta';

  PERFORM set_config('request.jwt.claims', '{"sub":"' || v_member_user_id || '"}', true);

  v_result := public.submit_participation_v3(
    v_competition_id,
    v_track_id,
    v_rule_id,
    'https://example.com/stage7-participation-proof'
  );
  v_log_id := (v_result->>'log_id')::uuid;

  IF NOT EXISTS (
    SELECT 1
    FROM public.leaderboard_case_messages
    WHERE participation_log_id = v_log_id
      AND message_type = 'system_event'
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.leaderboard_notifications
    WHERE participation_log_id = v_log_id
      AND recipient_user_id = v_admin_id
      AND event_type = 'participation_submitted'
  ) THEN
    RAISE EXCEPTION 'Participation activity was not captured or delivered to admins';
  END IF;

  PERFORM set_config('request.jwt.claims', '{"sub":"' || v_admin_id || '"}', true);
  BEGIN
    PERFORM public.review_participation_v3(v_log_id, 'rejected', NULL, '   ');
  EXCEPTION WHEN OTHERS THEN
    v_blank_rejection_blocked := SQLERRM = 'Rejected submissions require a member-visible reason';
  END;

  IF NOT v_blank_rejection_blocked
    OR NOT EXISTS (
      SELECT 1 FROM public.participation_logs
      WHERE id = v_log_id AND status = 'pending'
    )
  THEN
    RAISE EXCEPTION 'Blank participation rejection reason was not blocked safely';
  END IF;

  PERFORM set_config('request.jwt.claims', '{"sub":"' || v_member_user_id || '"}', true);
  v_result := public.submit_competition_proposal(
    'Stage 7 Conversation Test',
    'ARSC Universitas Brawijaya',
    'https://example.com/stage7-proposal',
    current_date,
    'Internal ARSC',
    'Umum',
    'Peserta',
    'https://example.com/stage7-proposal-proof',
    'Mohon ditinjau.'
  );
  v_proposal_id := (v_result->>'proposal_id')::uuid;

  IF NOT EXISTS (
    SELECT 1
    FROM public.leaderboard_case_messages
    WHERE proposal_id = v_proposal_id
      AND author_role = 'member'
      AND body = 'Mohon ditinjau.'
  ) THEN
    RAISE EXCEPTION 'Initial proposal note was not captured as case history';
  END IF;

  PERFORM set_config('request.jwt.claims', '{"sub":"' || v_admin_id || '"}', true);
  PERFORM public.review_competition_proposal(
    v_proposal_id,
    'needs_info',
    'Tambahkan tautan pengumuman hasil.',
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.leaderboard_case_messages
    WHERE proposal_id = v_proposal_id
      AND author_role = 'admin'
      AND visibility = 'member_admins'
      AND body = 'Tambahkan tautan pengumuman hasil.'
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.leaderboard_notifications
    WHERE proposal_id = v_proposal_id
      AND recipient_user_id = v_member_user_id
      AND event_type = 'proposal_needs_info'
  ) THEN
    RAISE EXCEPTION 'Admin review was not exposed to the proposal owner';
  END IF;

  PERFORM set_config('request.jwt.claims', '{"sub":"' || v_member_user_id || '"}', true);
  v_result := public.leaderboard_add_case_message(
    'proposal',
    v_proposal_id,
    'Tautan pengumuman sudah ditambahkan pada bukti.',
    'member_admins'
  );

  IF (v_result->>'case_reopened')::boolean IS DISTINCT FROM true
    OR NOT EXISTS (
      SELECT 1
      FROM public.leaderboard_competition_proposals
      WHERE id = v_proposal_id AND status = 'pending'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM public.leaderboard_notifications
      WHERE proposal_id = v_proposal_id
        AND recipient_user_id = v_admin_id
        AND event_type = 'proposal_resubmitted'
    )
  THEN
    RAISE EXCEPTION 'Member reply did not reopen and notify the proposal safely';
  END IF;

  PERFORM set_config('request.jwt.claims', '{"sub":"' || v_admin_id || '"}', true);
  PERFORM public.leaderboard_add_case_message(
    'proposal',
    v_proposal_id,
    'Catatan koordinasi antarpengurus.',
    'admins_only'
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.leaderboard_case_messages
    WHERE proposal_id = v_proposal_id
      AND message_type = 'admin_internal'
      AND visibility = 'admins_only'
  ) THEN
    RAISE EXCEPTION 'Admin-only case note was not stored';
  END IF;

  SELECT id INTO v_notification_id
  FROM public.leaderboard_notifications
  WHERE recipient_user_id = v_admin_id
    AND is_read = false
  ORDER BY created_at
  LIMIT 1;

  PERFORM public.leaderboard_mark_notification_read(v_notification_id);

  IF NOT EXISTS (
    SELECT 1
    FROM public.leaderboard_notifications
    WHERE id = v_notification_id
      AND is_read = true
      AND read_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Notification read state did not persist';
  END IF;

  v_result := public.leaderboard_save_competition_v2(
    NULL,
    'Stage 7 Empty Draft',
    current_date,
    'Safe deletion fixture',
    'Internal ARSC',
    false,
    v_template_id,
    NULL,
    '[{"name":"Umum"}]'::jsonb
  );
  v_empty_competition_id := (v_result->>'competition_id')::uuid;

  PERFORM public.leaderboard_delete_competition(v_empty_competition_id, 'Stage 7 Empty Draft');

  IF EXISTS (SELECT 1 FROM public.competitions WHERE id = v_empty_competition_id) THEN
    RAISE EXCEPTION 'Unused archived competition was not deleted';
  END IF;

  PERFORM public.leaderboard_save_competition_v2(
    v_competition_id,
    'Stage 7 Protected Competition',
    current_date,
    'Used competition must never be deleted',
    'Internal ARSC',
    false,
    v_template_id,
    NULL,
    jsonb_build_array(jsonb_build_object('id', v_track_id, 'name', 'Umum'))
  );

  BEGIN
    PERFORM public.leaderboard_delete_competition(v_competition_id, 'Stage 7 Protected Competition');
  EXCEPTION WHEN OTHERS THEN
    v_delete_blocked := SQLERRM = 'Competition has historical references and must remain archived';
  END;

  IF NOT v_delete_blocked
    OR NOT EXISTS (SELECT 1 FROM public.participation_logs WHERE id = v_log_id)
    OR NOT EXISTS (SELECT 1 FROM public.competitions WHERE id = v_competition_id)
  THEN
    RAISE EXCEPTION 'Guarded deletion did not preserve historical competition data';
  END IF;

  IF has_table_privilege('authenticated', 'public.leaderboard_case_messages', 'INSERT')
    OR has_table_privilege('authenticated', 'public.leaderboard_case_messages', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.leaderboard_case_messages', 'DELETE')
    OR has_table_privilege('authenticated', 'public.leaderboard_notifications', 'INSERT')
    OR has_table_privilege('authenticated', 'public.leaderboard_notifications', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.leaderboard_notifications', 'DELETE')
  THEN
    RAISE EXCEPTION 'Direct authenticated Stage 7 mutations remain available';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid IN (
      'public.participation_logs'::regclass,
      'public.verification_requests'::regclass
    )
      AND constraint_row.confrelid = 'public.competitions'::regclass
      AND constraint_row.confdeltype <> 'r'
  ) THEN
    RAISE EXCEPTION 'A destructive competition foreign key remains';
  END IF;

  SELECT md5(string_agg(
    table_name || ':' || column_name || ':' || data_type || ':' || is_nullable,
    ',' ORDER BY table_name, ordinal_position
  ))
  INTO v_schema_hash_after
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('rapor_members', 'rapor_releases', 'rapor_access_codes', 'users', 'arsc_identities');

  IF v_schema_hash_after IS DISTINCT FROM v_schema_hash_before THEN
    RAISE EXCEPTION 'A protected Rapor/Halo/shared table schema changed during Stage 7 validation';
  END IF;

  RAISE NOTICE 'Stage 7 case messaging, notifications, guarded delete, and protected boundaries passed.';
  RAISE NOTICE '--- ALL STAGE 7 TESTS PASSED ---';
END;
$$;

ROLLBACK;
