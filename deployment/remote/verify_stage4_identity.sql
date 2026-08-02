-- Read-only post-deployment verification for Stage 4.

BEGIN TRANSACTION READ ONLY;

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
    'link_leaderboard_profile_from_reference'
  ])
ORDER BY p.oid::regprocedure::text;

SELECT
  'protected_stage2c_function' AS category,
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
  AND p.proname = 'get_leaderboard_reference_members';

SELECT
  has_function_privilege('anon', 'public.get_public_leaderboard()', 'EXECUTE') AS anon_can_read_leaderboard,
  has_function_privilege('anon', 'public.get_public_member_participations(uuid)', 'EXECUTE') AS anon_can_read_approved_details,
  NOT has_function_privilege('anon', 'public.link_leaderboard_profile_from_reference(uuid,text,text,text,text,text)', 'EXECUTE') AS anon_cannot_link_identity,
  NOT has_function_privilege('authenticated', 'public.link_leaderboard_profile_from_reference(uuid,text,text,text,text,text)', 'EXECUTE') AS authenticated_cannot_link_identity,
  has_function_privilege('service_role', 'public.link_leaderboard_profile_from_reference(uuid,text,text,text,text,text)', 'EXECUTE') AS service_role_can_link_identity;

ROLLBACK;
