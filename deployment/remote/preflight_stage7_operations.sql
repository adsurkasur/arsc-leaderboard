-- Stage 7 enhanced read-only preflight.
-- Validates the Stage 6 contract, collision-free Stage 7 namespace, guarded
-- delete prerequisites, and protected Rapor/Halo/shared-object fingerprints.

BEGIN;

CREATE TEMP TABLE _stage7_preflight_results (
  category text NOT NULL,
  object_name text NOT NULL,
  check_name text NOT NULL,
  status text,
  metric_value bigint,
  hash_value text
) ON COMMIT DROP;

INSERT INTO _stage7_preflight_results
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
  'public.verification_requests',
  'public.profiles',
  'public.user_roles',
  'public.leaderboard_competition_tracks',
  'public.leaderboard_competition_proposals',
  'public.leaderboard_competition_scoring_rules'
]) AS required_object;

INSERT INTO _stage7_preflight_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'prerequisite_function',
  required_function,
  'exact_signature_exists',
  CASE WHEN to_regprocedure(required_function) IS NOT NULL THEN 'PASS' ELSE 'FAIL' END,
  CASE WHEN to_regprocedure(required_function) IS NOT NULL THEN 1 ELSE 0 END
FROM unnest(ARRAY[
  'public.leaderboard_has_role(uuid,public.app_role)',
  'public.submit_participation_v3(uuid,uuid,uuid,text)',
  'public.submit_competition_proposal(text,text,text,date,text,text,text,text,text)',
  'public.review_competition_proposal(uuid,text,text,uuid,text,date,text,text,boolean,uuid,jsonb,jsonb,uuid,text,text)'
]) AS required_function;

INSERT INTO _stage7_preflight_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'prerequisite_fk',
  expected.table_name,
  'competition_delete_is_cascade',
  CASE WHEN count(constraint_row.oid) = 1 AND bool_and(constraint_row.confdeltype = 'c') THEN 'PASS' ELSE 'FAIL' END,
  count(constraint_row.oid)
FROM (VALUES
  ('participation_logs'),
  ('verification_requests')
) AS expected(table_name)
LEFT JOIN pg_constraint constraint_row
  ON constraint_row.conrelid = format('public.%I', expected.table_name)::regclass
 AND constraint_row.confrelid = 'public.competitions'::regclass
 AND constraint_row.contype = 'f'
 AND (
   SELECT array_agg(attribute_row.attname::text ORDER BY attribute_row.attname::text)
   FROM unnest(constraint_row.conkey) AS key_row(attnum)
   JOIN pg_attribute attribute_row
     ON attribute_row.attrelid = constraint_row.conrelid
    AND attribute_row.attnum = key_row.attnum
 ) = ARRAY['competition_id']::text[]
GROUP BY expected.table_name;

INSERT INTO _stage7_preflight_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'preflight_gate',
  'stage7_tables',
  'collision_count',
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('leaderboard_case_messages', 'leaderboard_notifications');

INSERT INTO _stage7_preflight_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'preflight_gate',
  'stage7_functions',
  'collision_count',
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM pg_proc procedure_row
JOIN pg_namespace namespace_row ON namespace_row.oid = procedure_row.pronamespace
WHERE namespace_row.nspname = 'public'
  AND procedure_row.proname IN (
    'leaderboard_capture_proposal_activity',
    'leaderboard_capture_participation_activity',
    'leaderboard_add_case_message',
    'leaderboard_mark_notification_read',
    'leaderboard_mark_all_notifications_read',
    'review_participation_v3',
    'leaderboard_delete_competition'
  );

INSERT INTO _stage7_preflight_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'preflight_gate',
  'stage7_triggers',
  'collision_count',
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM pg_trigger
WHERE tgname IN (
  'leaderboard_proposal_activity',
  'leaderboard_participation_activity'
)
  AND NOT tgisinternal;

INSERT INTO _stage7_preflight_results
  (category, object_name, check_name, status, metric_value)
SELECT 'data_inventory', 'competitions', 'row_count', 'OBSERVED', count(*) FROM public.competitions
UNION ALL
SELECT 'data_inventory', 'competition_proposals', 'row_count', 'OBSERVED', count(*) FROM public.leaderboard_competition_proposals
UNION ALL
SELECT 'data_inventory', 'participation_logs', 'row_count', 'OBSERVED', count(*) FROM public.participation_logs
UNION ALL
SELECT 'data_inventory', 'proposal_review_notes', 'nonempty_count', 'OBSERVED', count(*)
FROM public.leaderboard_competition_proposals WHERE NULLIF(btrim(review_notes), '') IS NOT NULL
UNION ALL
SELECT 'data_inventory', 'participation_review_notes', 'nonempty_count', 'OBSERVED', count(*)
FROM public.participation_logs WHERE NULLIF(btrim(notes), '') IS NOT NULL;

INSERT INTO _stage7_preflight_results
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
      SELECT string_agg(trigger_row.tgname || ':' || pg_get_triggerdef(trigger_row.oid), ',' ORDER BY trigger_row.tgname)
      FROM pg_trigger trigger_row
      WHERE trigger_row.tgrelid = format('%I.%I', target.table_schema, target.table_name)::regclass
        AND NOT trigger_row.tgisinternal
    ), ''),
    COALESCE((
      SELECT string_agg(grant_row.grantee || ':' || grant_row.privilege_type, ',' ORDER BY grant_row.grantee, grant_row.privilege_type)
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

INSERT INTO _stage7_preflight_results
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

INSERT INTO _stage7_preflight_results
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

INSERT INTO _stage7_preflight_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'preflight_gate',
  'stage7_readiness',
  'failure_count',
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM _stage7_preflight_results
WHERE status = 'FAIL';

SELECT *
FROM _stage7_preflight_results
ORDER BY category, object_name, check_name;

ROLLBACK;
