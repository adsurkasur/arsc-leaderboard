-- Read-only, single-result post-deployment verification for Stage 4 shared identity.
-- The output is intentionally normalized for one-click export from Supabase SQL Editor.

BEGIN TRANSACTION READ ONLY;

WITH
protected_tables(table_name) AS (
  VALUES
    ('users'),
    ('profiles'),
    ('members'),
    ('member_release_links'),
    ('participation_logs'),
    ('competitions'),
    ('rapor_releases'),
    ('rapor_members'),
    ('rapor_access_codes')
),
table_fingerprints(check_name, object_name, hash_value) AS (
  SELECT
    'columns'::text,
    pt.table_name,
    md5(COALESCE(string_agg(
      concat_ws(':', c.ordinal_position::text, c.column_name, c.data_type, c.udt_schema, c.udt_name, c.is_nullable, COALESCE(c.column_default, '')),
      ',' ORDER BY c.ordinal_position
    ), 'MISSING'))
  FROM protected_tables pt
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public' AND c.table_name = pt.table_name
  GROUP BY pt.table_name

  UNION ALL

  SELECT
    'constraints',
    pt.table_name,
    md5(COALESCE(string_agg(
      concat_ws(':', con.conname, con.contype::text, pg_get_constraintdef(con.oid, true)),
      ',' ORDER BY con.conname
    ), 'MISSING'))
  FROM protected_tables pt
  LEFT JOIN pg_catalog.pg_class cls
    ON cls.relname = pt.table_name AND cls.relnamespace = 'public'::regnamespace
  LEFT JOIN pg_catalog.pg_constraint con ON con.conrelid = cls.oid
  GROUP BY pt.table_name

  UNION ALL

  SELECT
    'rls',
    pt.table_name,
    md5(COALESCE(concat_ws(':', cls.relrowsecurity::text, cls.relforcerowsecurity::text), 'MISSING'))
  FROM protected_tables pt
  LEFT JOIN pg_catalog.pg_class cls
    ON cls.relname = pt.table_name AND cls.relnamespace = 'public'::regnamespace

  UNION ALL

  SELECT
    'policies',
    pt.table_name,
    md5(COALESCE(string_agg(
      concat_ws(':', pol.polname, pol.polcmd::text, pol.polroles::text, pg_get_expr(pol.polqual, pol.polrelid), pg_get_expr(pol.polwithcheck, pol.polrelid)),
      ',' ORDER BY pol.polname
    ), 'MISSING'))
  FROM protected_tables pt
  LEFT JOIN pg_catalog.pg_class cls
    ON cls.relname = pt.table_name AND cls.relnamespace = 'public'::regnamespace
  LEFT JOIN pg_catalog.pg_policy pol ON pol.polrelid = cls.oid
  GROUP BY pt.table_name

  UNION ALL

  SELECT
    'grants',
    pt.table_name,
    md5(COALESCE(string_agg(
      concat_ws(':', grants.grantee, grants.privilege_type, grants.is_grantable),
      ',' ORDER BY grants.grantee, grants.privilege_type
    ), 'MISSING'))
  FROM protected_tables pt
  LEFT JOIN information_schema.role_table_grants grants
    ON grants.table_schema = 'public' AND grants.table_name = pt.table_name
  GROUP BY pt.table_name

  UNION ALL

  SELECT
    'triggers',
    pt.table_name,
    md5(COALESCE(string_agg(
      concat_ws(':', trg.tgname, pg_get_triggerdef(trg.oid, true)),
      ',' ORDER BY trg.tgname
    ), 'MISSING'))
  FROM protected_tables pt
  LEFT JOIN pg_catalog.pg_class cls
    ON cls.relname = pt.table_name AND cls.relnamespace = 'public'::regnamespace
  LEFT JOIN pg_catalog.pg_trigger trg ON trg.tgrelid = cls.oid AND NOT trg.tgisinternal
  GROUP BY pt.table_name
),
protected_function_fingerprints(object_name, hash_value) AS (
  SELECT
    p.oid::regprocedure::text,
    md5(concat_ws(':',
      pg_get_function_identity_arguments(p.oid),
      pg_get_function_result(p.oid),
      pg_get_functiondef(p.oid),
      p.prosecdef::text,
      p.provolatile::text,
      owner.rolname,
      COALESCE(p.proconfig::text, ''),
      COALESCE(p.proacl::text, '')
    ))
  FROM pg_catalog.pg_proc p
  INNER JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  INNER JOIN pg_catalog.pg_roles owner ON owner.oid = p.proowner
  WHERE n.nspname = 'public'
    AND p.proname = ANY (ARRAY[
      'get_leaderboard_reference_members',
      'handle_new_user',
      'handle_new_auth_user',
      'handle_auth_user_email_update',
      'current_app_role',
      'sync_admin_profile',
      'sync_whatsapp_to_auth_phone'
    ])
),
auth_trigger_fingerprints(object_name, hash_value) AS (
  SELECT t.tgname, md5(pg_get_triggerdef(t.oid, true))
  FROM pg_catalog.pg_trigger t
  INNER JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
  INNER JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'auth'
    AND c.relname = 'users'
    AND NOT t.tgisinternal
),
expected_stage4_functions(function_identity) AS (
  VALUES
    ('get_public_leaderboard()'),
    ('get_public_member_participations(uuid)'),
    ('get_public_category_participation_counts(text)'),
    ('upsert_leaderboard_reference_member(text,text,text,text,text)'),
    ('link_arsc_account_from_reference(uuid,text,text,text,text,text)'),
    ('get_my_arsc_identity()'),
    ('set_shared_profile_avatar(uuid,text)'),
    ('protect_verified_arsc_identity_fields()'),
    ('protect_verified_leaderboard_identity_fields()'),
    ('sync_halo_avatar_to_leaderboard()')
),
stage4_function_checks(object_name, status, hash_value) AS (
  SELECT
    expected.function_identity,
    CASE
      WHEN p.oid IS NULL THEN 'MISSING'
      WHEN NOT p.prosecdef THEN 'FAIL'
      WHEN COALESCE(array_to_string(p.proconfig, ','), '') <> 'search_path=""' THEN 'FAIL'
      ELSE 'PASS'
    END,
    CASE WHEN p.oid IS NULL THEN NULL ELSE md5(concat_ws(':',
      pg_get_function_result(p.oid),
      pg_get_functiondef(p.oid),
      p.prosecdef::text,
      p.provolatile::text,
      owner.rolname,
      COALESCE(p.proconfig::text, ''),
      COALESCE(p.proacl::text, '')
    )) END
  FROM expected_stage4_functions expected
  LEFT JOIN pg_catalog.pg_proc p ON p.oid = to_regprocedure('public.' || expected.function_identity)
  LEFT JOIN pg_catalog.pg_roles owner ON owner.oid = p.proowner
),
expected_stage4_triggers(table_name, trigger_name) AS (
  VALUES
    ('arsc_identities', 'arsc_identities_updated_at'),
    ('profiles', 'arsc_verified_profile_guard'),
    ('users', 'arsc_shared_avatar_sync'),
    ('users', 'arsc_verified_identity_guard')
),
stage4_trigger_checks(object_name, status, hash_value) AS (
  SELECT
    concat_ws('.', 'public', expected.table_name, expected.trigger_name),
    CASE WHEN trg.oid IS NULL THEN 'MISSING' ELSE 'PASS' END,
    CASE WHEN trg.oid IS NULL THEN NULL ELSE md5(pg_get_triggerdef(trg.oid, true)) END
  FROM expected_stage4_triggers expected
  LEFT JOIN pg_catalog.pg_class cls
    ON cls.relname = expected.table_name AND cls.relnamespace = 'public'::regnamespace
  LEFT JOIN pg_catalog.pg_trigger trg
    ON trg.tgrelid = cls.oid
   AND trg.tgname = expected.trigger_name
   AND NOT trg.tgisinternal
),
identity_metrics(metric, metric_value) AS (
  SELECT 'verified_identities'::text, count(*)::bigint FROM public.arsc_identities
  UNION ALL
  SELECT 'verified_with_halo_profile', count(*)
  FROM public.arsc_identities i INNER JOIN public.users u ON u.id = i.auth_user_id
  UNION ALL
  SELECT 'verified_with_leaderboard_profile', count(*)
  FROM public.arsc_identities i
  INNER JOIN public.profiles p
    ON p.user_id = i.auth_user_id AND p.member_id = i.member_id
  UNION ALL
  SELECT 'halo_email_mismatch', count(*)
  FROM auth.users au
  INNER JOIN public.users hu ON hu.id = au.id
  WHERE lower(COALESCE(hu.email, '')) IS DISTINCT FROM lower(COALESCE(au.email::text, ''))
),
privilege_checks(check_name, passed) AS (
  SELECT 'anon_can_read_leaderboard', has_function_privilege('anon', 'public.get_public_leaderboard()', 'EXECUTE')
  UNION ALL
  SELECT 'anon_can_read_approved_details', has_function_privilege('anon', 'public.get_public_member_participations(uuid)', 'EXECUTE')
  UNION ALL
  SELECT 'anon_cannot_link_identity', NOT has_function_privilege('anon', 'public.link_arsc_account_from_reference(uuid,text,text,text,text,text)', 'EXECUTE')
  UNION ALL
  SELECT 'authenticated_cannot_link_identity', NOT has_function_privilege('authenticated', 'public.link_arsc_account_from_reference(uuid,text,text,text,text,text)', 'EXECUTE')
  UNION ALL
  SELECT 'service_role_can_link_identity', has_function_privilege('service_role', 'public.link_arsc_account_from_reference(uuid,text,text,text,text,text)', 'EXECUTE')
  UNION ALL
  SELECT 'authenticated_can_read_own_identity', has_function_privilege('authenticated', 'public.get_my_arsc_identity()', 'EXECUTE')
  UNION ALL
  SELECT 'authenticated_cannot_bypass_avatar_service', NOT has_function_privilege('authenticated', 'public.set_shared_profile_avatar(uuid,text)', 'EXECUTE')
),
results(result_order, category, object_name, check_name, status, metric_value, hash_value) AS (
  SELECT
    100,
    'stage4_table',
    'public.arsc_identities',
    'exists',
    CASE WHEN to_regclass('public.arsc_identities') IS NULL THEN 'MISSING' ELSE 'PASS' END,
    NULL::bigint,
    NULL::text

  UNION ALL

  SELECT
    110,
    'stage4_table',
    'public.arsc_identities',
    'rls_enabled',
    CASE WHEN cls.relrowsecurity THEN 'PASS' ELSE 'FAIL' END,
    NULL,
    NULL
  FROM pg_catalog.pg_class cls
  WHERE cls.oid = to_regclass('public.arsc_identities')

  UNION ALL

  SELECT
    120,
    'stage4_table',
    'public.arsc_identities',
    'columns',
    'OBSERVED',
    NULL,
    md5(COALESCE(string_agg(
      concat_ws(':', a.attnum::text, a.attname, pg_catalog.format_type(a.atttypid, a.atttypmod), a.attnotnull::text),
      ',' ORDER BY a.attnum
    ), 'MISSING'))
  FROM pg_catalog.pg_class cls
  LEFT JOIN pg_catalog.pg_attribute a
    ON a.attrelid = cls.oid AND a.attnum > 0 AND NOT a.attisdropped
  WHERE cls.oid = to_regclass('public.arsc_identities')

  UNION ALL

  SELECT 200, 'protected_table_fingerprint', object_name, check_name, 'OBSERVED', NULL, hash_value
  FROM table_fingerprints

  UNION ALL

  SELECT 300, 'protected_function_fingerprint', object_name, 'definition_and_privileges', 'OBSERVED', NULL, hash_value
  FROM protected_function_fingerprints

  UNION ALL

  SELECT 400, 'protected_auth_trigger_fingerprint', object_name, 'complete_definition', 'OBSERVED', NULL, hash_value
  FROM auth_trigger_fingerprints

  UNION ALL

  SELECT 500, 'stage4_function', object_name, 'security_contract', status, NULL, hash_value
  FROM stage4_function_checks

  UNION ALL

  SELECT 600, 'stage4_trigger', object_name, 'complete_definition', status, NULL, hash_value
  FROM stage4_trigger_checks

  UNION ALL

  SELECT
    700,
    'identity_alignment_count',
    'shared_identity',
    metric,
    CASE WHEN metric = 'halo_email_mismatch' AND metric_value <> 0 THEN 'FAIL' ELSE 'OBSERVED' END,
    metric_value,
    NULL
  FROM identity_metrics

  UNION ALL

  SELECT
    800,
    'privilege_check',
    'stage4_rpc_access',
    check_name,
    CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN passed THEN 1 ELSE 0 END,
    NULL
  FROM privilege_checks
),
final_results AS (
  SELECT * FROM results

  UNION ALL

  SELECT
    900,
    'verification_gate',
    'stage4_structure_and_privileges',
    'failure_count',
    CASE WHEN count(*) FILTER (WHERE status IN ('FAIL', 'MISSING')) = 0 THEN 'PASS' ELSE 'BLOCKED' END,
    count(*) FILTER (WHERE status IN ('FAIL', 'MISSING')),
    NULL
  FROM results
)
SELECT
  category,
  object_name,
  check_name,
  status,
  metric_value,
  hash_value
FROM final_results
ORDER BY result_order, category, object_name, check_name;

ROLLBACK;
