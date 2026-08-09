-- Stage 5 read-only post-deployment verification.
-- Compare protected fingerprints mechanically with preflight_stage5_scoring.sql.

BEGIN;

CREATE TEMP TABLE _stage5_verification_results (
  category text NOT NULL,
  object_name text NOT NULL,
  check_name text NOT NULL,
  status text,
  metric_value bigint,
  hash_value text
) ON COMMIT DROP;

INSERT INTO _stage5_verification_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'stage5_table',
  required_object,
  'exists',
  CASE WHEN to_regclass(required_object) IS NOT NULL THEN 'PASS' ELSE 'FAIL' END,
  CASE WHEN to_regclass(required_object) IS NOT NULL THEN 1 ELSE 0 END
FROM unnest(ARRAY[
  'public.leaderboard_scoring_templates',
  'public.leaderboard_scoring_template_rules',
  'public.leaderboard_competition_scoring_rules'
]) AS required_object;

INSERT INTO _stage5_verification_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'stage5_seed',
  'leaderboard_scoring_templates',
  'system_template_count',
  CASE WHEN count(*) = 6 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM public.leaderboard_scoring_templates
WHERE is_system = true
UNION ALL
SELECT
  'stage5_seed',
  'leaderboard_scoring_template_rules',
  'system_rule_count',
  CASE WHEN count(*) = 35 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM public.leaderboard_scoring_template_rules
UNION ALL
SELECT
  'stage5_seed',
  'pkm',
  'required_stage_count',
  CASE WHEN count(*) = 6 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM public.leaderboard_scoring_template_rules rule
JOIN public.leaderboard_scoring_templates template ON template.id = rule.template_id
WHERE template.code = 'pkm';

INSERT INTO _stage5_verification_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'stage5_data_gate',
  'competitions',
  'competitions_without_rules',
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM public.competitions competition
WHERE NOT EXISTS (
  SELECT 1
  FROM public.leaderboard_competition_scoring_rules rule
  WHERE rule.competition_id = competition.id
    AND rule.is_active = true
);

INSERT INTO _stage5_verification_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'stage5_function',
  expected.function_name,
  'exact_signature_exists',
  CASE WHEN to_regprocedure(expected.signature) IS NOT NULL THEN 'PASS' ELSE 'FAIL' END,
  CASE WHEN to_regprocedure(expected.signature) IS NOT NULL THEN 1 ELSE 0 END
FROM (VALUES
  ('leaderboard_save_competition', 'public.leaderboard_save_competition(uuid,text,date,text,text,boolean,uuid,jsonb)'),
  ('submit_participation_v2', 'public.submit_participation_v2(uuid,uuid,text)'),
  ('review_participation_v2', 'public.review_participation_v2(uuid,text,uuid,text)'),
  ('get_public_leaderboard_v2', 'public.get_public_leaderboard_v2()'),
  ('get_public_member_participations_v2', 'public.get_public_member_participations_v2(uuid)'),
  ('get_public_category_scores_v2', 'public.get_public_category_scores_v2(text)')
) AS expected(function_name, signature);

INSERT INTO _stage5_verification_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'privilege_check',
  'competitions',
  'authenticated_direct_writes_blocked',
  CASE WHEN NOT (
    has_table_privilege('authenticated', 'public.competitions', 'INSERT')
    OR has_table_privilege('authenticated', 'public.competitions', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.competitions', 'DELETE')
  ) THEN 'PASS' ELSE 'FAIL' END,
  CASE WHEN NOT (
    has_table_privilege('authenticated', 'public.competitions', 'INSERT')
    OR has_table_privilege('authenticated', 'public.competitions', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.competitions', 'DELETE')
  ) THEN 1 ELSE 0 END
UNION ALL
SELECT
  'privilege_check',
  'leaderboard_competition_scoring_rules',
  'authenticated_direct_writes_blocked',
  CASE WHEN NOT (
    has_table_privilege('authenticated', 'public.leaderboard_competition_scoring_rules', 'INSERT')
    OR has_table_privilege('authenticated', 'public.leaderboard_competition_scoring_rules', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.leaderboard_competition_scoring_rules', 'DELETE')
  ) THEN 'PASS' ELSE 'FAIL' END,
  CASE WHEN NOT (
    has_table_privilege('authenticated', 'public.leaderboard_competition_scoring_rules', 'INSERT')
    OR has_table_privilege('authenticated', 'public.leaderboard_competition_scoring_rules', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.leaderboard_competition_scoring_rules', 'DELETE')
  ) THEN 1 ELSE 0 END;

INSERT INTO _stage5_verification_results
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
        c.column_name || ':' || c.data_type || ':' || c.is_nullable || ':' || COALESCE(c.column_default, ''),
        ',' ORDER BY c.ordinal_position
      )
      FROM information_schema.columns c
      WHERE c.table_schema = target.table_schema AND c.table_name = target.table_name
    ), ''),
    COALESCE((
      SELECT string_agg(
        con.contype::text || ':' || con.conname || ':' || pg_get_constraintdef(con.oid),
        ',' ORDER BY con.contype, con.conname
      )
      FROM pg_constraint con
      WHERE con.conrelid = format('%I.%I', target.table_schema, target.table_name)::regclass
    ), ''),
    COALESCE((
      SELECT string_agg(
        pol.policyname || ':' || pol.cmd || ':' || pol.roles::text || ':' || COALESCE(pol.qual, '') || ':' || COALESCE(pol.with_check, ''),
        ',' ORDER BY pol.policyname
      )
      FROM pg_policies pol
      WHERE pol.schemaname = target.table_schema AND pol.tablename = target.table_name
    ), ''),
    COALESCE((
      SELECT string_agg(
        trg.tgname || ':' || pg_get_triggerdef(trg.oid),
        ',' ORDER BY trg.tgname
      )
      FROM pg_trigger trg
      WHERE trg.tgrelid = format('%I.%I', target.table_schema, target.table_name)::regclass
        AND NOT trg.tgisinternal
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
      SELECT cls.relrowsecurity::text
      FROM pg_class cls
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
      WHERE ns.nspname = target.table_schema AND cls.relname = target.table_name
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

INSERT INTO _stage5_verification_results
  (category, object_name, check_name, status, hash_value)
SELECT
  'protected_function_fingerprint',
  p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
  'definition_and_security',
  'OBSERVED',
  md5(
    pg_get_functiondef(p.oid)
    || ':' || p.prosecdef::text
    || ':' || p.provolatile::text
    || ':' || owner_role.rolname
    || ':' || COALESCE(array_to_string(p.proconfig, ','), '')
    || ':' || COALESCE(p.proacl::text, '')
  )
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_roles owner_role ON owner_role.oid = p.proowner
WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_leaderboard_reference_members',
    'link_arsc_account_from_reference',
    'get_my_arsc_identity',
    'set_shared_profile_avatar',
    'protect_verified_arsc_identity_fields',
    'protect_verified_leaderboard_identity_fields',
    'sync_halo_avatar_to_leaderboard'
  );

INSERT INTO _stage5_verification_results
  (category, object_name, check_name, status, hash_value)
SELECT
  'protected_auth_trigger_fingerprint',
  trg.tgname,
  'complete_definition',
  'OBSERVED',
  md5(pg_get_triggerdef(trg.oid))
FROM pg_trigger trg
WHERE trg.tgrelid = 'auth.users'::regclass
  AND NOT trg.tgisinternal;

INSERT INTO _stage5_verification_results
  (category, object_name, check_name, status, metric_value)
SELECT
  'verification_gate',
  'stage5_structure_and_privileges',
  'failure_count',
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
  count(*)
FROM _stage5_verification_results
WHERE status = 'FAIL';

SELECT *
FROM _stage5_verification_results
ORDER BY category, object_name, check_name;

ROLLBACK;
