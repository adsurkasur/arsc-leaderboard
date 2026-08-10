-- Stage 7 read-only verification. Always rolls back.

BEGIN;

CREATE TEMP TABLE _stage7_verification_results (
  category text NOT NULL,
  object_name text NOT NULL,
  check_name text NOT NULL,
  status text,
  metric_value bigint,
  hash_value text
) ON COMMIT DROP;

INSERT INTO _stage7_verification_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'stage7_table',
  required_table,
  'exists',
  CASE WHEN to_regclass(required_table) IS NOT NULL THEN 'PASS' ELSE 'FAIL' END,
  CASE WHEN to_regclass(required_table) IS NOT NULL THEN 1 ELSE 0 END
FROM unnest(ARRAY[
  'public.leaderboard_case_messages',
  'public.leaderboard_notifications'
]) AS required_table;

INSERT INTO _stage7_verification_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'stage7_function',
  expected.function_name,
  'exact_signature_exists',
  CASE WHEN count(namespace_row.oid) = 1 THEN 'PASS' ELSE 'FAIL' END,
  count(namespace_row.oid)
FROM (VALUES
  ('leaderboard_add_case_message', 'p_case_type text, p_case_id uuid, p_body text, p_visibility text'),
  ('leaderboard_mark_notification_read', 'p_notification_id uuid'),
  ('leaderboard_mark_all_notifications_read', ''),
  ('review_participation_v3', 'p_log_id uuid, p_status text, p_scoring_rule_id uuid, p_notes text'),
  ('leaderboard_delete_competition', 'p_competition_id uuid, p_confirmation_title text'),
  ('leaderboard_capture_proposal_activity', ''),
  ('leaderboard_capture_participation_activity', '')
) AS expected(function_name, identity_arguments)
LEFT JOIN pg_proc procedure_row
  ON procedure_row.proname = expected.function_name
 AND pg_get_function_identity_arguments(procedure_row.oid) = expected.identity_arguments
LEFT JOIN pg_namespace namespace_row
  ON namespace_row.oid = procedure_row.pronamespace
 AND namespace_row.nspname = 'public'
GROUP BY expected.function_name;

INSERT INTO _stage7_verification_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'stage7_trigger',
  expected.trigger_name,
  'exists_on_expected_table',
  CASE WHEN count(trigger_row.oid) = 1 THEN 'PASS' ELSE 'FAIL' END,
  count(trigger_row.oid)
FROM (VALUES
  ('leaderboard_proposal_activity', 'public.leaderboard_competition_proposals'::regclass),
  ('leaderboard_participation_activity', 'public.participation_logs'::regclass)
) AS expected(trigger_name, relation_id)
LEFT JOIN pg_trigger trigger_row
  ON trigger_row.tgname = expected.trigger_name
 AND trigger_row.tgrelid = expected.relation_id
 AND NOT trigger_row.tgisinternal
GROUP BY expected.trigger_name;

INSERT INTO _stage7_verification_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'stage7_fk',
  expected.table_name,
  'competition_delete_is_restrict',
  CASE WHEN count(constraint_row.oid) = 1 AND bool_and(constraint_row.confdeltype = 'r') THEN 'PASS' ELSE 'FAIL' END,
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

INSERT INTO _stage7_verification_results
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
  ('leaderboard_case_messages'),
  ('leaderboard_notifications')
) AS target(table_name);

INSERT INTO _stage7_verification_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'stage7_data_gate',
  'leaderboard_competition_proposals',
  'review_notes_backfilled',
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM public.leaderboard_competition_proposals proposal
WHERE NULLIF(btrim(proposal.review_notes), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.leaderboard_case_messages message_row
    WHERE message_row.proposal_id = proposal.id
      AND message_row.message_type = 'admin_response'
      AND message_row.body = btrim(proposal.review_notes)
  )
UNION ALL
SELECT
  'stage7_data_gate',
  'participation_logs',
  'review_notes_backfilled',
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM public.participation_logs participation
WHERE NULLIF(btrim(participation.notes), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.leaderboard_case_messages message_row
    WHERE message_row.participation_log_id = participation.id
      AND message_row.message_type = 'admin_response'
      AND message_row.body = btrim(participation.notes)
  );

INSERT INTO _stage7_verification_results
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

INSERT INTO _stage7_verification_results
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

INSERT INTO _stage7_verification_results
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

INSERT INTO _stage7_verification_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'verification_gate',
  'stage7_structure_and_privileges',
  'failure_count',
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM _stage7_verification_results
WHERE status = 'FAIL';

SELECT *
FROM _stage7_verification_results
ORDER BY category, object_name, check_name;

ROLLBACK;
