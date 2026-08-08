-- Read-only post-deployment verification for Stage 4 shared identity.

BEGIN TRANSACTION READ ONLY;

SELECT
  c.oid::regclass::text AS table_identity,
  c.relrowsecurity AS rls_enabled,
  md5(COALESCE(string_agg(
    concat_ws(':', a.attnum::text, a.attname, pg_catalog.format_type(a.atttypid, a.atttypmod), a.attnotnull::text),
    ',' ORDER BY a.attnum
  ), 'MISSING')) AS columns_hash
FROM pg_catalog.pg_class c
INNER JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_catalog.pg_attribute a
  ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
WHERE n.nspname = 'public' AND c.relname = 'arsc_identities'
GROUP BY c.oid, c.relrowsecurity;

WITH protected_tables(table_name) AS (
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
), fingerprints AS (
  SELECT
    'columns'::text AS check_name,
    pt.table_name AS object_name,
    md5(COALESCE(string_agg(
      concat_ws(':', c.ordinal_position::text, c.column_name, c.data_type, c.udt_schema, c.udt_name, c.is_nullable, COALESCE(c.column_default, '')),
      ',' ORDER BY c.ordinal_position
    ), 'MISSING')) AS hash_value
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
)
SELECT 'protected_table_fingerprint' AS category, object_name, check_name, hash_value
FROM fingerprints
ORDER BY object_name, check_name;

SELECT
  'protected_function_fingerprint' AS category,
  p.oid::regprocedure::text AS object_name,
  md5(concat_ws(':',
    pg_get_function_identity_arguments(p.oid),
    pg_get_function_result(p.oid),
    pg_get_functiondef(p.oid),
    p.prosecdef::text,
    p.provolatile::text,
    owner.rolname,
    COALESCE(p.proconfig::text, ''),
    COALESCE(p.proacl::text, '')
  )) AS hash_value
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
ORDER BY p.oid::regprocedure::text;

SELECT
  'protected_auth_trigger_fingerprint' AS category,
  t.tgname AS object_name,
  md5(pg_get_triggerdef(t.oid, true)) AS hash_value
FROM pg_catalog.pg_trigger t
INNER JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
INNER JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'auth'
  AND c.relname = 'users'
  AND NOT t.tgisinternal
ORDER BY t.tgname;

SELECT
  p.oid::regprocedure::text AS function_identity,
  pg_get_function_result(p.oid) AS return_contract,
  p.prosecdef AS security_definer,
  p.provolatile::text AS volatility,
  owner.rolname AS owner,
  p.proconfig,
  p.proacl,
  md5(pg_get_functiondef(p.oid)) AS definition_hash
FROM pg_catalog.pg_proc p
INNER JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
INNER JOIN pg_catalog.pg_roles owner ON owner.oid = p.proowner
WHERE n.nspname = 'public'
  AND p.proname = ANY (ARRAY[
    'get_public_leaderboard',
    'get_public_member_participations',
    'get_public_category_participation_counts',
    'upsert_leaderboard_reference_member',
    'link_arsc_account_from_reference',
    'get_my_arsc_identity',
    'set_shared_profile_avatar',
    'protect_verified_arsc_identity_fields',
    'protect_verified_leaderboard_identity_fields',
    'sync_halo_avatar_to_leaderboard'
  ])
ORDER BY p.oid::regprocedure::text;

SELECT
  'stage4_trigger' AS category,
  concat_ws('.', n.nspname, c.relname, t.tgname) AS object_name,
  pg_get_triggerdef(t.oid, true) AS definition,
  md5(pg_get_triggerdef(t.oid, true)) AS definition_hash
FROM pg_catalog.pg_trigger t
INNER JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
INNER JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND (
    (c.relname = 'users' AND t.tgname IN ('arsc_verified_identity_guard', 'arsc_shared_avatar_sync'))
    OR (c.relname = 'profiles' AND t.tgname = 'arsc_verified_profile_guard')
    OR (c.relname = 'arsc_identities' AND t.tgname = 'arsc_identities_updated_at')
  )
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

SELECT
  'identity_alignment_count' AS category,
  metric,
  metric_value
FROM (
  SELECT 'verified_identities'::text AS metric, count(*)::bigint AS metric_value FROM public.arsc_identities
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
) metrics
ORDER BY metric;

SELECT
  has_function_privilege('anon', 'public.get_public_leaderboard()', 'EXECUTE') AS anon_can_read_leaderboard,
  has_function_privilege('anon', 'public.get_public_member_participations(uuid)', 'EXECUTE') AS anon_can_read_approved_details,
  NOT has_function_privilege('anon', 'public.link_arsc_account_from_reference(uuid,text,text,text,text,text)', 'EXECUTE') AS anon_cannot_link_identity,
  NOT has_function_privilege('authenticated', 'public.link_arsc_account_from_reference(uuid,text,text,text,text,text)', 'EXECUTE') AS authenticated_cannot_link_identity,
  has_function_privilege('service_role', 'public.link_arsc_account_from_reference(uuid,text,text,text,text,text)', 'EXECUTE') AS service_role_can_link_identity,
  has_function_privilege('authenticated', 'public.get_my_arsc_identity()', 'EXECUTE') AS authenticated_can_read_own_identity,
  NOT has_function_privilege('authenticated', 'public.set_shared_profile_avatar(uuid,text)', 'EXECUTE') AS authenticated_cannot_bypass_avatar_service;

ROLLBACK;
