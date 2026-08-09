-- Stage 6 enhanced read-only preflight.
-- Captures deployment gates and protected Rapor/Halo/shared-object fingerprints.

BEGIN;

CREATE TEMP TABLE _stage6_preflight_results (
  category text NOT NULL,
  object_name text NOT NULL,
  check_name text NOT NULL,
  status text,
  metric_value bigint,
  hash_value text
) ON COMMIT DROP;

INSERT INTO _stage6_preflight_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'prerequisite',
  required_object,
  'exists',
  CASE WHEN to_regclass(required_object) IS NOT NULL THEN 'PASS' ELSE 'FAIL' END,
  CASE WHEN to_regclass(required_object) IS NOT NULL THEN 1 ELSE 0 END
FROM unnest(ARRAY[
  'public.competitions',
  'public.participation_logs',
  'public.participation_submission_events',
  'public.profiles',
  'public.arsc_identities',
  'public.leaderboard_scoring_templates',
  'public.leaderboard_scoring_template_rules',
  'public.leaderboard_competition_scoring_rules'
]) AS required_object;

INSERT INTO _stage6_preflight_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'prerequisite_function',
  required_function,
  'exact_signature_exists',
  CASE WHEN to_regprocedure(required_function) IS NOT NULL THEN 'PASS' ELSE 'FAIL' END,
  CASE WHEN to_regprocedure(required_function) IS NOT NULL THEN 1 ELSE 0 END
FROM unnest(ARRAY[
  'public.leaderboard_has_role(uuid,public.app_role)',
  'public.leaderboard_update_updated_at()',
  'public.leaderboard_save_competition(uuid,text,date,text,text,boolean,uuid,jsonb)',
  'public.submit_participation_v2(uuid,uuid,text)',
  'public.review_participation_v2(uuid,text,uuid,text)'
]) AS required_function;

INSERT INTO _stage6_preflight_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'prerequisite',
  'participation_logs',
  'legacy_profile_competition_unique_constraint',
  CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM pg_constraint con
WHERE con.conrelid = 'public.participation_logs'::regclass
  AND con.contype = 'u'
  AND (
    SELECT array_agg(att.attname::text ORDER BY att.attname::text)
    FROM unnest(con.conkey) AS key(attnum)
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum = key.attnum
  ) = ARRAY['competition_id', 'profile_id']::text[];

INSERT INTO _stage6_preflight_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'preflight_gate',
  'stage6_tables',
  'collision_count',
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'leaderboard_competition_tracks',
    'leaderboard_competition_proposals'
  );

INSERT INTO _stage6_preflight_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'preflight_gate',
  'stage6_functions',
  'collision_count',
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM pg_proc procedure_row
JOIN pg_namespace namespace_row ON namespace_row.oid = procedure_row.pronamespace
WHERE namespace_row.nspname = 'public'
  AND procedure_row.proname IN (
    'leaderboard_save_competition_v2',
    'submit_participation_v3',
    'submit_competition_proposal',
    'review_competition_proposal',
    'get_public_member_participations_v3'
  );

INSERT INTO _stage6_preflight_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'preflight_gate',
  'stage6_columns',
  'collision_count',
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'participation_logs' AND column_name = 'competition_track_id')
    OR (
      table_name = 'participation_submission_events'
      AND column_name IN ('competition_track_id', 'competition_track_name')
    )
  );

INSERT INTO _stage6_preflight_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'preflight_gate',
  'internal_arsc_preset',
  'collision_count',
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM public.leaderboard_scoring_templates
WHERE code = 'internal-arsc'
   OR id = '00000000-0000-4000-8000-000000000507'::uuid;

INSERT INTO _stage6_preflight_results
  (category, object_name, check_name, status, metric_value)
SELECT 'data_inventory', 'competitions', 'row_count', 'OBSERVED', count(*)
FROM public.competitions
UNION ALL
SELECT 'data_inventory', 'participation_logs', 'row_count', 'OBSERVED', count(*)
FROM public.participation_logs
UNION ALL
SELECT 'data_inventory', 'participation_logs', 'approved_count', 'OBSERVED', count(*)
FROM public.participation_logs WHERE status = 'approved'
UNION ALL
SELECT 'data_inventory', 'participation_logs', 'pending_count', 'OBSERVED', count(*)
FROM public.participation_logs WHERE status = 'pending'
UNION ALL
SELECT 'data_inventory', 'leaderboard_scoring_templates', 'row_count', 'OBSERVED', count(*)
FROM public.leaderboard_scoring_templates
UNION ALL
SELECT 'data_inventory', 'leaderboard_scoring_template_rules', 'row_count', 'OBSERVED', count(*)
FROM public.leaderboard_scoring_template_rules;

INSERT INTO _stage6_preflight_results
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

INSERT INTO _stage6_preflight_results
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

INSERT INTO _stage6_preflight_results
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

INSERT INTO _stage6_preflight_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'preflight_gate',
  'stage6_readiness',
  'failure_count',
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM _stage6_preflight_results
WHERE status = 'FAIL';

SELECT *
FROM _stage6_preflight_results
ORDER BY category, object_name, check_name;

ROLLBACK;
