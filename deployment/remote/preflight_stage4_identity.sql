-- Enhanced read-only preflight for Stage 4 identity and public reads.
-- Run manually in the Supabase SQL Editor only after explicit approval.

BEGIN TRANSACTION READ ONLY;

SELECT
  'prerequisite' AS category,
  required_object AS object_name,
  CASE
    WHEN required_object LIKE '%(%)' THEN
      CASE WHEN to_regprocedure(required_object) IS NULL THEN 'MISSING' ELSE 'READY' END
    ELSE
      CASE WHEN to_regclass(required_object) IS NULL THEN 'MISSING' ELSE 'READY' END
  END AS status
FROM (
  VALUES
    ('public.profiles'),
    ('public.members'),
    ('public.member_release_links'),
    ('public.participation_logs'),
    ('public.competitions'),
    ('public.rapor_releases'),
    ('public.rapor_members'),
    ('public.rapor_access_codes'),
    ('public.get_leaderboard_reference_members()')
) AS required(required_object)
ORDER BY required_object;

SELECT
  'stage4_function_collision' AS category,
  p.oid::regprocedure::text AS object_name,
  'COLLISION' AS status
FROM pg_catalog.pg_proc p
INNER JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = ANY (ARRAY[
    'get_public_leaderboard',
    'get_public_member_participations',
    'get_public_category_participation_counts',
    'upsert_leaderboard_reference_member',
    'link_leaderboard_profile_from_reference'
  ])
ORDER BY p.oid::regprocedure::text;

WITH protected_tables(table_name) AS (
  VALUES
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
  AND p.proname = 'get_leaderboard_reference_members'
ORDER BY p.oid::regprocedure::text;

ROLLBACK;
