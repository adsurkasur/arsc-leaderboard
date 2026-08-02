-- Operational rollback for Stage 4 functions only.
-- Does not delete or alter Leaderboard, Rapor, Halo PSDM, or shared table data.
-- Run manually only with separate explicit approval.

BEGIN;

DROP FUNCTION IF EXISTS public.get_public_leaderboard();
DROP FUNCTION IF EXISTS public.get_public_member_participations(uuid);
DROP FUNCTION IF EXISTS public.get_public_category_participation_counts(text);
DROP FUNCTION IF EXISTS public.upsert_leaderboard_reference_member(text, text, text, text, text);
DROP FUNCTION IF EXISTS public.link_leaderboard_profile_from_reference(uuid, text, text, text, text, text);

COMMIT;
