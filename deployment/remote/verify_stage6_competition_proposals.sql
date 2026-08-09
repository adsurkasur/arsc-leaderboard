-- Stage 6 read-only verification. Always rolls back.

BEGIN;

CREATE TEMP TABLE _stage6_verification_results (
  category text NOT NULL,
  object_name text NOT NULL,
  check_name text NOT NULL,
  status text,
  metric_value bigint,
  hash_value text
) ON COMMIT DROP;

INSERT INTO _stage6_verification_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'stage6_table',
  required_table,
  'exists',
  CASE WHEN to_regclass(required_table) IS NOT NULL THEN 'PASS' ELSE 'FAIL' END,
  CASE WHEN to_regclass(required_table) IS NOT NULL THEN 1 ELSE 0 END
FROM unnest(ARRAY[
  'public.leaderboard_competition_tracks',
  'public.leaderboard_competition_proposals'
]) AS required_table;

INSERT INTO _stage6_verification_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'stage6_column',
  expected.table_name,
  expected.column_name || '_type',
  CASE WHEN column_row.data_type = expected.data_type THEN 'PASS' ELSE 'FAIL' END,
  CASE WHEN column_row.data_type = expected.data_type THEN 1 ELSE 0 END
FROM (VALUES
  ('participation_logs', 'competition_track_id', 'uuid'),
  ('participation_submission_events', 'competition_track_id', 'uuid'),
  ('participation_submission_events', 'competition_track_name', 'text')
) AS expected(table_name, column_name, data_type)
LEFT JOIN information_schema.columns column_row
  ON column_row.table_schema = 'public'
 AND column_row.table_name = expected.table_name
 AND column_row.column_name = expected.column_name;

INSERT INTO _stage6_verification_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'stage6_constraint',
  'participation_logs',
  'profile_competition_track_unique',
  CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM pg_constraint constraint_row
WHERE constraint_row.conrelid = 'public.participation_logs'::regclass
  AND constraint_row.contype = 'u'
  AND (
    SELECT array_agg(attribute_row.attname::text ORDER BY attribute_row.attname::text)
    FROM unnest(constraint_row.conkey) AS key(attnum)
    JOIN pg_attribute attribute_row
      ON attribute_row.attrelid = constraint_row.conrelid
     AND attribute_row.attnum = key.attnum
  ) = ARRAY['competition_id', 'competition_track_id', 'profile_id']::text[];

INSERT INTO _stage6_verification_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'stage6_function',
  expected.function_name,
  'exact_signature_exists',
  CASE WHEN count(namespace_row.oid) = 1 THEN 'PASS' ELSE 'FAIL' END,
  count(namespace_row.oid)
FROM (VALUES
  ('leaderboard_save_competition_v2', 'p_competition_id uuid, p_title text, p_date date, p_description text, p_category text, p_is_active boolean, p_template_id uuid, p_rules jsonb, p_tracks jsonb'),
  ('submit_participation_v3', 'p_competition_id uuid, p_competition_track_id uuid, p_scoring_rule_id uuid, p_evidence_url text'),
  ('submit_competition_proposal', 'p_title text, p_organizer text, p_information_url text, p_date date, p_level text, p_track_name text, p_achievement text, p_evidence_url text, p_member_notes text'),
  ('review_competition_proposal', 'p_proposal_id uuid, p_status text, p_review_notes text, p_competition_id uuid, p_title text, p_date date, p_description text, p_category text, p_is_active boolean, p_template_id uuid, p_rules jsonb, p_tracks jsonb, p_track_id uuid, p_track_name text, p_scoring_rule_label text'),
  ('get_public_member_participations_v3', 'p_profile_id uuid')
) AS expected(function_name, identity_arguments)
LEFT JOIN pg_proc procedure_row
  ON procedure_row.proname = expected.function_name
 AND pg_get_function_identity_arguments(procedure_row.oid) = expected.identity_arguments
LEFT JOIN pg_namespace namespace_row
  ON namespace_row.oid = procedure_row.pronamespace
 AND namespace_row.nspname = 'public'
GROUP BY expected.function_name;

INSERT INTO _stage6_verification_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'stage6_seed',
  'leaderboard_scoring_templates',
  'system_template_count',
  CASE WHEN count(*) = 7 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM public.leaderboard_scoring_templates
WHERE is_system = true
UNION ALL
SELECT
  'stage6_seed',
  'leaderboard_scoring_template_rules',
  'system_rule_count',
  CASE WHEN count(*) = 61 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM public.leaderboard_scoring_template_rules rule_row
JOIN public.leaderboard_scoring_templates template_row ON template_row.id = rule_row.template_id
WHERE template_row.is_system = true
UNION ALL
SELECT
  'stage6_seed',
  'internal-arsc',
  'required_stage_count',
  CASE WHEN count(*) = 5 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM public.leaderboard_scoring_template_rules rule_row
JOIN public.leaderboard_scoring_templates template_row ON template_row.id = rule_row.template_id
WHERE template_row.code = 'internal-arsc'
  AND (rule_row.label, rule_row.points) IN (
    ('Juara 1', 15),
    ('Juara 2', 12),
    ('Juara 3', 10),
    ('Finalis', 6),
    ('Peserta', 2)
  );

INSERT INTO _stage6_verification_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'stage6_data_gate',
  'competitions',
  'competitions_without_active_tracks',
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM public.competitions competition
WHERE NOT EXISTS (
  SELECT 1
  FROM public.leaderboard_competition_tracks track
  WHERE track.competition_id = competition.id
    AND track.is_active = true
);

INSERT INTO _stage6_verification_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'privilege_check',
  target.table_name,
  'authenticated_direct_writes_blocked',
  CASE
    WHEN NOT has_table_privilege('authenticated', format('public.%I', target.table_name), 'INSERT')
      AND NOT has_table_privilege('authenticated', format('public.%I', target.table_name), 'UPDATE')
      AND NOT has_table_privilege('authenticated', format('public.%I', target.table_name), 'DELETE')
    THEN 'PASS'
    ELSE 'FAIL'
  END,
  CASE
    WHEN NOT has_table_privilege('authenticated', format('public.%I', target.table_name), 'INSERT')
      AND NOT has_table_privilege('authenticated', format('public.%I', target.table_name), 'UPDATE')
      AND NOT has_table_privilege('authenticated', format('public.%I', target.table_name), 'DELETE')
    THEN 1
    ELSE 0
  END
FROM (VALUES
  ('leaderboard_competition_tracks'),
  ('leaderboard_competition_proposals')
) AS target(table_name);

INSERT INTO _stage6_verification_results
  (category, object_name, check_name, status, hash_value)
SELECT
  'protected_table_fingerprint',
  target.table_name,
  'complete_structure',
  'OBSERVED',
  md5(concat_ws(
    '#',
    COALESCE((
      SELECT string_agg(
        column_row.column_name || ':' || column_row.data_type || ':' || column_row.is_nullable || ':' || COALESCE(column_row.column_default, ''),
        ',' ORDER BY column_row.ordinal_position
      )
      FROM information_schema.columns column_row
      WHERE column_row.table_schema = target.table_schema
        AND column_row.table_name = target.table_name
    ), ''),
    COALESCE((
      SELECT string_agg(
        constraint_row.contype::text || ':' || constraint_row.conname || ':' || pg_get_constraintdef(constraint_row.oid),
        ',' ORDER BY constraint_row.contype, constraint_row.conname
      )
      FROM pg_constraint constraint_row
      WHERE constraint_row.conrelid = format('%I.%I', target.table_schema, target.table_name)::regclass
    ), ''),
    COALESCE((
      SELECT string_agg(
        policy_row.policyname || ':' || policy_row.cmd || ':' || policy_row.roles::text || ':' || COALESCE(policy_row.qual, '') || ':' || COALESCE(policy_row.with_check, ''),
        ',' ORDER BY policy_row.policyname
      )
      FROM pg_policies policy_row
      WHERE policy_row.schemaname = target.table_schema
        AND policy_row.tablename = target.table_name
    ), ''),
    COALESCE((
      SELECT string_agg(
        trigger_row.tgname || ':' || pg_get_triggerdef(trigger_row.oid),
        ',' ORDER BY trigger_row.tgname
      )
      FROM pg_trigger trigger_row
      WHERE trigger_row.tgrelid = format('%I.%I', target.table_schema, target.table_name)::regclass
        AND NOT trigger_row.tgisinternal
    ), ''),
    COALESCE((
      SELECT string_agg(
        grant_row.grantee || ':' || grant_row.privilege_type,
        ',' ORDER BY grant_row.grantee, grant_row.privilege_type
      )
      FROM information_schema.role_table_grants grant_row
      WHERE grant_row.table_schema = target.table_schema
        AND grant_row.table_name = target.table_name
    ), ''),
    COALESCE((
      SELECT class_row.relrowsecurity::text
      FROM pg_class class_row
      JOIN pg_namespace namespace_row ON namespace_row.oid = class_row.relnamespace
      WHERE namespace_row.nspname = target.table_schema
        AND class_row.relname = target.table_name
    ), '')
  ))
FROM (VALUES
  ('public', 'members'),
  ('public', 'member_release_links'),
  ('public', 'profiles'),
  ('public', 'users'),
  ('public', 'arsc_identities'),
  ('public', 'rapor_members'),
  ('public', 'rapor_releases'),
  ('public', 'rapor_access_codes')
) AS target(table_schema, table_name)
WHERE to_regclass(format('%I.%I', target.table_schema, target.table_name)) IS NOT NULL;

INSERT INTO _stage6_verification_results
  (category, object_name, check_name, status, hash_value)
SELECT
  'protected_function_fingerprint',
  procedure_row.proname || '(' || pg_get_function_identity_arguments(procedure_row.oid) || ')',
  'definition_and_security',
  'OBSERVED',
  md5(
    pg_get_functiondef(procedure_row.oid)
    || ':' || procedure_row.prosecdef::text
    || ':' || procedure_row.provolatile::text
    || ':' || owner_role.rolname
    || ':' || COALESCE(array_to_string(procedure_row.proconfig, ','), '')
    || ':' || COALESCE(procedure_row.proacl::text, '')
  )
FROM pg_proc procedure_row
JOIN pg_namespace namespace_row ON namespace_row.oid = procedure_row.pronamespace
JOIN pg_roles owner_role ON owner_role.oid = procedure_row.proowner
WHERE namespace_row.nspname = 'public'
  AND procedure_row.proname IN (
    'get_leaderboard_reference_members',
    'link_arsc_account_from_reference',
    'get_my_arsc_identity',
    'set_shared_profile_avatar',
    'protect_verified_arsc_identity_fields',
    'protect_verified_leaderboard_identity_fields',
    'sync_halo_avatar_to_leaderboard'
  );

INSERT INTO _stage6_verification_results
  (category, object_name, check_name, status, hash_value)
SELECT
  'protected_auth_trigger_fingerprint',
  trigger_row.tgname,
  'complete_definition',
  'OBSERVED',
  md5(pg_get_triggerdef(trigger_row.oid))
FROM pg_trigger trigger_row
WHERE trigger_row.tgrelid = 'auth.users'::regclass
  AND NOT trigger_row.tgisinternal;

INSERT INTO _stage6_verification_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'verification_gate',
  'stage6_structure_and_privileges',
  'failure_count',
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM _stage6_verification_results
WHERE status = 'FAIL';

SELECT *
FROM _stage6_verification_results
ORDER BY category, object_name, check_name;

ROLLBACK;
