-- Stage 7 operational rollback.
-- Disables Stage 7 write behavior while preserving all captured messages,
-- notifications, and the safer RESTRICT foreign keys.

BEGIN;

DROP TRIGGER IF EXISTS leaderboard_proposal_activity
  ON public.leaderboard_competition_proposals;
DROP TRIGGER IF EXISTS leaderboard_participation_activity
  ON public.participation_logs;

REVOKE ALL ON FUNCTION public.leaderboard_add_case_message(text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.leaderboard_mark_notification_read(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.leaderboard_mark_all_notifications_read()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_participation_v3(uuid, text, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.leaderboard_delete_competition(uuid, text)
  FROM PUBLIC, anon, authenticated;

-- Data tables intentionally remain readable through their existing RLS policies.
-- The competition foreign keys intentionally remain ON DELETE RESTRICT because
-- restoring CASCADE would reintroduce a destructive operator path.

COMMIT;
