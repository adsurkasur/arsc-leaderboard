-- Operational rollback for Stage 4 executable behavior only.
-- The arsc_identities table and verified links are deliberately preserved.
-- No Rapor data, Halo operational rows, credentials, or Leaderboard data are deleted.
-- Run manually only with separate explicit approval.

BEGIN;

DROP TRIGGER IF EXISTS arsc_verified_identity_guard ON public.users;
DROP TRIGGER IF EXISTS arsc_shared_avatar_sync ON public.users;
DROP TRIGGER IF EXISTS arsc_verified_profile_guard ON public.profiles;

DROP FUNCTION IF EXISTS public.get_public_leaderboard();
DROP FUNCTION IF EXISTS public.get_public_member_participations(uuid);
DROP FUNCTION IF EXISTS public.get_public_category_participation_counts(text);
DROP FUNCTION IF EXISTS public.upsert_leaderboard_reference_member(text, text, text, text, text);
DROP FUNCTION IF EXISTS public.link_arsc_account_from_reference(uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.get_my_arsc_identity();
DROP FUNCTION IF EXISTS public.set_shared_profile_avatar(uuid, text);
DROP FUNCTION IF EXISTS public.protect_verified_arsc_identity_fields();
DROP FUNCTION IF EXISTS public.protect_verified_leaderboard_identity_fields();
DROP FUNCTION IF EXISTS public.sync_halo_avatar_to_leaderboard();

COMMIT;
