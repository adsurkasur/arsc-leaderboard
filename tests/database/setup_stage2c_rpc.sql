-- Stage 2C: Controlled Read-Only Synchronization RPC
-- This safely exposes minimized Rapor reference data to authenticated users (e.g., the Leaderboard)
-- without granting direct SELECT access on the private rapor_members table.

CREATE OR REPLACE FUNCTION public.get_leaderboard_reference_members()
RETURNS TABLE (
  release_member_code text,
  release_code text,
  canonical_name text,
  unit text,
  "position" text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    m.member_code AS release_member_code, 
    m.release_code, 
    m.name AS canonical_name, 
    m.unit, 
    m.jabatan AS position
  FROM public.rapor_members m
  INNER JOIN public.rapor_releases r 
    ON m.release_code = r.release_code
  WHERE r.is_active = true 
    AND r.status = 'published';
$$;

-- Revoke execution from public, anon, and authenticated
REVOKE ALL ON FUNCTION public.get_leaderboard_reference_members() FROM PUBLIC, anon, authenticated;

-- Grant execution explicitly only to service_role
GRANT EXECUTE ON FUNCTION public.get_leaderboard_reference_members() TO service_role;
CREATE OR REPLACE FUNCTION public.leaderboard_has_role(p_user_id UUID, p_role TEXT) RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = '' AS 'SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = p_role::public.app_role)'; GRANT EXECUTE ON FUNCTION public.leaderboard_has_role TO authenticated;

-- Bootstrap fixture used by Stage 4 timestamp triggers. The production function
-- is created by leaderboard_bootstrap_schema.sql before Stage 4 is deployed.
CREATE OR REPLACE FUNCTION public.leaderboard_update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
