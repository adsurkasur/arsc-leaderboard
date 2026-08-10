-- Stage 7: case messaging, notifications, and guarded competition deletion.
-- Run only after the enhanced Stage 7 preflight passes.
-- This artifact does not modify Rapor, Halo PSDM, auth triggers, or shared identity data.

BEGIN;

DO $$
DECLARE
  v_missing text;
  v_collision_count integer;
BEGIN
  SELECT string_agg(required_object, ', ' ORDER BY required_object)
  INTO v_missing
  FROM unnest(ARRAY[
    'public.competitions',
    'public.participation_logs',
    'public.participation_submission_events',
    'public.verification_requests',
    'public.profiles',
    'public.user_roles',
    'public.leaderboard_competition_tracks',
    'public.leaderboard_competition_proposals',
    'public.leaderboard_competition_scoring_rules'
  ]) AS required_object
  WHERE to_regclass(required_object) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stage 7 prerequisites are missing: %', v_missing;
  END IF;

  IF to_regprocedure('public.leaderboard_has_role(uuid,public.app_role)') IS NULL
    OR to_regprocedure('public.submit_participation_v3(uuid,uuid,uuid,text)') IS NULL
    OR to_regprocedure('public.submit_competition_proposal(text,text,text,date,text,text,text,text,text)') IS NULL
    OR to_regprocedure('public.review_competition_proposal(uuid,text,text,uuid,text,date,text,text,boolean,uuid,jsonb,jsonb,uuid,text,text)') IS NULL
  THEN
    RAISE EXCEPTION 'Stage 6 function contract is incomplete';
  END IF;

  SELECT count(*) INTO v_collision_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('leaderboard_case_messages', 'leaderboard_notifications');

  IF v_collision_count <> 0 THEN
    RAISE EXCEPTION 'Stage 7 table collision detected';
  END IF;

  SELECT count(*) INTO v_collision_count
  FROM pg_proc procedure_row
  JOIN pg_namespace namespace_row ON namespace_row.oid = procedure_row.pronamespace
  WHERE namespace_row.nspname = 'public'
    AND procedure_row.proname IN (
      'leaderboard_capture_proposal_activity',
      'leaderboard_capture_participation_activity',
      'leaderboard_add_case_message',
      'leaderboard_mark_notification_read',
      'leaderboard_mark_all_notifications_read',
      'review_participation_v3',
      'leaderboard_delete_competition'
    );

  IF v_collision_count <> 0 THEN
    RAISE EXCEPTION 'Stage 7 function collision detected';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname IN ('leaderboard_proposal_activity', 'leaderboard_participation_activity')
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Stage 7 trigger collision detected';
  END IF;
END;
$$;

CREATE TABLE public.leaderboard_case_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES public.leaderboard_competition_proposals(id) ON DELETE CASCADE,
  participation_log_id uuid REFERENCES public.participation_logs(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_role text NOT NULL,
  visibility text NOT NULL DEFAULT 'member_admins',
  message_type text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leaderboard_case_messages_subject_check
    CHECK (num_nonnulls(proposal_id, participation_log_id) = 1),
  CONSTRAINT leaderboard_case_messages_author_role_check
    CHECK (author_role IN ('member', 'admin', 'system')),
  CONSTRAINT leaderboard_case_messages_visibility_check
    CHECK (visibility IN ('member_admins', 'admins_only')),
  CONSTRAINT leaderboard_case_messages_type_check
    CHECK (message_type IN ('member_message', 'admin_response', 'admin_internal', 'system_event')),
  CONSTRAINT leaderboard_case_messages_body_check
    CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
  CONSTRAINT leaderboard_case_messages_internal_check
    CHECK (
      (message_type = 'admin_internal' AND visibility = 'admins_only' AND author_role = 'admin')
      OR message_type <> 'admin_internal'
    )
);

CREATE INDEX leaderboard_case_messages_proposal_idx
  ON public.leaderboard_case_messages (proposal_id, created_at, id)
  WHERE proposal_id IS NOT NULL;

CREATE INDEX leaderboard_case_messages_participation_idx
  ON public.leaderboard_case_messages (participation_log_id, created_at, id)
  WHERE participation_log_id IS NOT NULL;

CREATE TABLE public.leaderboard_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES public.leaderboard_competition_proposals(id) ON DELETE CASCADE,
  participation_log_id uuid REFERENCES public.participation_logs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leaderboard_notifications_subject_check
    CHECK (num_nonnulls(proposal_id, participation_log_id) = 1),
  CONSTRAINT leaderboard_notifications_event_type_check
    CHECK (event_type IN (
      'proposal_submitted',
      'proposal_resubmitted',
      'proposal_needs_info',
      'proposal_accepted',
      'proposal_rejected',
      'participation_submitted',
      'participation_resubmitted',
      'participation_approved',
      'participation_rejected',
      'case_message',
      'admin_internal_note'
    )),
  CONSTRAINT leaderboard_notifications_title_check
    CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  CONSTRAINT leaderboard_notifications_message_check
    CHECK (length(btrim(message)) BETWEEN 1 AND 500),
  CONSTRAINT leaderboard_notifications_read_state_check
    CHECK (
      (is_read = false AND read_at IS NULL)
      OR (is_read = true AND read_at IS NOT NULL)
    )
);

CREATE INDEX leaderboard_notifications_recipient_idx
  ON public.leaderboard_notifications (recipient_user_id, is_read, created_at DESC);

ALTER TABLE public.leaderboard_case_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their case messages"
ON public.leaderboard_case_messages
FOR SELECT
TO authenticated
USING (
  visibility = 'member_admins'
  AND (
    EXISTS (
      SELECT 1
      FROM public.leaderboard_competition_proposals proposal
      WHERE proposal.id = proposal_id
        AND proposal.submitted_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.participation_logs participation
      JOIN public.profiles profile ON profile.id = participation.profile_id
      WHERE participation.id = participation_log_id
        AND profile.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Admins can view all case messages"
ON public.leaderboard_case_messages
FOR SELECT
TO authenticated
USING (public.leaderboard_has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their Leaderboard notifications"
ON public.leaderboard_notifications
FOR SELECT
TO authenticated
USING (recipient_user_id = auth.uid());

REVOKE ALL ON public.leaderboard_case_messages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.leaderboard_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.leaderboard_case_messages TO authenticated;
GRANT SELECT ON public.leaderboard_notifications TO authenticated;
GRANT ALL ON public.leaderboard_case_messages TO postgres, service_role;
GRANT ALL ON public.leaderboard_notifications TO postgres, service_role;

-- Preserve existing user-facing notes as immutable case history before triggers start.
INSERT INTO public.leaderboard_case_messages (
  proposal_id,
  author_user_id,
  author_role,
  visibility,
  message_type,
  body,
  created_at
)
SELECT
  proposal.id,
  proposal.submitted_by,
  'member',
  'member_admins',
  'member_message',
  btrim(proposal.member_notes),
  proposal.created_at
FROM public.leaderboard_competition_proposals proposal
WHERE NULLIF(btrim(proposal.member_notes), '') IS NOT NULL;

INSERT INTO public.leaderboard_case_messages (
  proposal_id,
  author_user_id,
  author_role,
  visibility,
  message_type,
  body,
  created_at
)
SELECT
  proposal.id,
  proposal.reviewed_by,
  'admin',
  'member_admins',
  'admin_response',
  btrim(proposal.review_notes),
  COALESCE(proposal.reviewed_at, proposal.updated_at)
FROM public.leaderboard_competition_proposals proposal
WHERE NULLIF(btrim(proposal.review_notes), '') IS NOT NULL;

INSERT INTO public.leaderboard_case_messages (
  participation_log_id,
  author_user_id,
  author_role,
  visibility,
  message_type,
  body,
  created_at
)
SELECT
  participation.id,
  participation.admin_id,
  'admin',
  'member_admins',
  'admin_response',
  btrim(participation.notes),
  COALESCE(participation.verified_at, participation.created_at)
FROM public.participation_logs participation
WHERE NULLIF(btrim(participation.notes), '') IS NOT NULL;

CREATE FUNCTION public.leaderboard_capture_proposal_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status_label text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NULLIF(btrim(NEW.member_notes), '') IS NOT NULL THEN
      INSERT INTO public.leaderboard_case_messages (
        proposal_id, author_user_id, author_role, visibility, message_type, body
      ) VALUES (
        NEW.id, NEW.submitted_by, 'member', 'member_admins', 'member_message', btrim(NEW.member_notes)
      );
    END IF;

    INSERT INTO public.leaderboard_notifications (
      recipient_user_id, proposal_id, event_type, title, message
    )
    SELECT
      role_row.user_id,
      NEW.id,
      'proposal_submitted',
      'Usulan kompetisi baru',
      NEW.proposed_title || ' menunggu peninjauan.'
    FROM public.user_roles role_row
    WHERE role_row.role = 'admin'
      AND role_row.user_id <> NEW.submitted_by;

    RETURN NEW;
  END IF;

  IF NEW.member_notes IS DISTINCT FROM OLD.member_notes
    AND NULLIF(btrim(NEW.member_notes), '') IS NOT NULL
  THEN
    INSERT INTO public.leaderboard_case_messages (
      proposal_id, author_user_id, author_role, visibility, message_type, body
    ) VALUES (
      NEW.id, NEW.submitted_by, 'member', 'member_admins', 'member_message', btrim(NEW.member_notes)
    );

    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
      INSERT INTO public.leaderboard_notifications (
        recipient_user_id, proposal_id, event_type, title, message
      )
      SELECT
        role_row.user_id,
        NEW.id,
        'proposal_resubmitted',
        'Informasi usulan diperbarui',
        NEW.proposed_title || ' memiliki informasi baru dari anggota.'
      FROM public.user_roles role_row
      WHERE role_row.role = 'admin'
        AND role_row.user_id <> NEW.submitted_by;
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_status_label := CASE NEW.status
      WHEN 'pending' THEN 'Menunggu peninjauan'
      WHEN 'needs_info' THEN 'Memerlukan informasi tambahan'
      WHEN 'accepted' THEN 'Diterima dan ditambahkan'
      WHEN 'rejected' THEN 'Ditolak'
      ELSE NEW.status
    END;

    IF NEW.review_notes IS DISTINCT FROM OLD.review_notes
      AND NULLIF(btrim(NEW.review_notes), '') IS NOT NULL
    THEN
      INSERT INTO public.leaderboard_case_messages (
        proposal_id, author_user_id, author_role, visibility, message_type, body
      ) VALUES (
        NEW.id, NEW.reviewed_by, 'admin', 'member_admins', 'admin_response', btrim(NEW.review_notes)
      );
    END IF;

    INSERT INTO public.leaderboard_case_messages (
      proposal_id, author_user_id, author_role, visibility, message_type, body
    ) VALUES (
      NEW.id, NULL, 'system', 'member_admins', 'system_event', 'Status usulan: ' || v_status_label || '.'
    );

    IF NEW.status = 'pending' THEN
      INSERT INTO public.leaderboard_notifications (
        recipient_user_id, proposal_id, event_type, title, message
      )
      SELECT
        role_row.user_id,
        NEW.id,
        'proposal_resubmitted',
        'Usulan siap ditinjau kembali',
        NEW.proposed_title || ' memiliki jawaban atau pembaruan dari anggota.'
      FROM public.user_roles role_row
      WHERE role_row.role = 'admin'
        AND role_row.user_id <> NEW.submitted_by;
    ELSE
      INSERT INTO public.leaderboard_notifications (
        recipient_user_id, proposal_id, event_type, title, message
      ) VALUES (
        NEW.submitted_by,
        NEW.id,
        CASE NEW.status
          WHEN 'needs_info' THEN 'proposal_needs_info'
          WHEN 'accepted' THEN 'proposal_accepted'
          ELSE 'proposal_rejected'
        END,
        CASE NEW.status
          WHEN 'needs_info' THEN 'Informasi tambahan diperlukan'
          WHEN 'accepted' THEN 'Usulan kompetisi diterima'
          ELSE 'Usulan kompetisi ditolak'
        END,
        NEW.proposed_title || ': ' || v_status_label || '.'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.leaderboard_capture_participation_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner_user_id uuid;
  v_competition_title text;
  v_status_label text;
BEGIN
  SELECT profile.user_id, competition.title
  INTO v_owner_user_id, v_competition_title
  FROM public.profiles profile
  JOIN public.competitions competition ON competition.id = NEW.competition_id
  WHERE profile.id = NEW.profile_id;

  IF v_owner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.leaderboard_case_messages (
      participation_log_id, author_user_id, author_role, visibility, message_type, body
    ) VALUES (
      NEW.id, NULL, 'system', 'member_admins', 'system_event', 'Pengajuan partisipasi dikirim untuk ditinjau.'
    );

    INSERT INTO public.leaderboard_notifications (
      recipient_user_id, participation_log_id, event_type, title, message
    )
    SELECT
      role_row.user_id,
      NEW.id,
      'participation_submitted',
      'Pengajuan partisipasi baru',
      v_competition_title || ' menunggu peninjauan.'
    FROM public.user_roles role_row
    WHERE role_row.role = 'admin'
      AND role_row.user_id <> v_owner_user_id;

    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_status_label := CASE NEW.status
      WHEN 'pending' THEN 'Menunggu peninjauan'
      WHEN 'approved' THEN 'Disetujui'
      WHEN 'rejected' THEN 'Ditolak'
      ELSE NEW.status
    END;

    IF NEW.notes IS DISTINCT FROM OLD.notes
      AND NULLIF(btrim(NEW.notes), '') IS NOT NULL
    THEN
      INSERT INTO public.leaderboard_case_messages (
        participation_log_id, author_user_id, author_role, visibility, message_type, body
      ) VALUES (
        NEW.id, NEW.admin_id, 'admin', 'member_admins', 'admin_response', btrim(NEW.notes)
      );
    END IF;

    INSERT INTO public.leaderboard_case_messages (
      participation_log_id, author_user_id, author_role, visibility, message_type, body
    ) VALUES (
      NEW.id, NULL, 'system', 'member_admins', 'system_event', 'Status partisipasi: ' || v_status_label || '.'
    );

    IF NEW.status = 'pending' THEN
      INSERT INTO public.leaderboard_notifications (
        recipient_user_id, participation_log_id, event_type, title, message
      )
      SELECT
        role_row.user_id,
        NEW.id,
        'participation_resubmitted',
        'Partisipasi diajukan kembali',
        v_competition_title || ' siap ditinjau kembali.'
      FROM public.user_roles role_row
      WHERE role_row.role = 'admin'
        AND role_row.user_id <> v_owner_user_id;
    ELSE
      INSERT INTO public.leaderboard_notifications (
        recipient_user_id, participation_log_id, event_type, title, message
      ) VALUES (
        v_owner_user_id,
        NEW.id,
        CASE WHEN NEW.status = 'approved' THEN 'participation_approved' ELSE 'participation_rejected' END,
        CASE WHEN NEW.status = 'approved' THEN 'Partisipasi disetujui' ELSE 'Partisipasi ditolak' END,
        v_competition_title || ': ' || v_status_label || '.'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER leaderboard_proposal_activity
AFTER INSERT OR UPDATE ON public.leaderboard_competition_proposals
FOR EACH ROW EXECUTE FUNCTION public.leaderboard_capture_proposal_activity();

CREATE TRIGGER leaderboard_participation_activity
AFTER INSERT OR UPDATE ON public.participation_logs
FOR EACH ROW EXECUTE FUNCTION public.leaderboard_capture_participation_activity();

CREATE FUNCTION public.leaderboard_add_case_message(
  p_case_type text,
  p_case_id uuid,
  p_body text,
  p_visibility text DEFAULT 'member_admins'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_is_admin boolean;
  v_owner_id uuid;
  v_case_status text;
  v_message_id uuid;
  v_reopened boolean := false;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_case_type NOT IN ('proposal', 'participation') THEN
    RAISE EXCEPTION 'Invalid case type';
  END IF;
  IF p_case_id IS NULL THEN
    RAISE EXCEPTION 'Case id is required';
  END IF;
  IF NULLIF(btrim(p_body), '') IS NULL OR length(btrim(p_body)) > 2000 THEN
    RAISE EXCEPTION 'Message must contain 1 to 2000 characters';
  END IF;
  IF p_visibility NOT IN ('member_admins', 'admins_only') THEN
    RAISE EXCEPTION 'Invalid message visibility';
  END IF;

  v_is_admin := public.leaderboard_has_role(v_actor_id, 'admin');

  IF p_case_type = 'proposal' THEN
    SELECT submitted_by, status
    INTO v_owner_id, v_case_status
    FROM public.leaderboard_competition_proposals
    WHERE id = p_case_id
    FOR UPDATE;
  ELSE
    SELECT profile.user_id, participation.status
    INTO v_owner_id, v_case_status
    FROM public.participation_logs participation
    JOIN public.profiles profile ON profile.id = participation.profile_id
    WHERE participation.id = p_case_id
    FOR UPDATE OF participation;
  END IF;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Case not found';
  END IF;
  IF NOT v_is_admin AND v_owner_id IS DISTINCT FROM v_actor_id THEN
    RAISE EXCEPTION 'Not authorized for this case';
  END IF;
  IF NOT v_is_admin AND p_visibility <> 'member_admins' THEN
    RAISE EXCEPTION 'Members cannot create internal admin notes';
  END IF;
  IF NOT v_is_admin
    AND (
      (p_case_type = 'proposal' AND v_case_status NOT IN ('pending', 'needs_info'))
      OR (p_case_type = 'participation' AND v_case_status <> 'pending')
    )
  THEN
    RAISE EXCEPTION 'This case is closed for member replies';
  END IF;

  INSERT INTO public.leaderboard_case_messages (
    proposal_id,
    participation_log_id,
    author_user_id,
    author_role,
    visibility,
    message_type,
    body
  ) VALUES (
    CASE WHEN p_case_type = 'proposal' THEN p_case_id ELSE NULL END,
    CASE WHEN p_case_type = 'participation' THEN p_case_id ELSE NULL END,
    v_actor_id,
    CASE WHEN v_is_admin THEN 'admin' ELSE 'member' END,
    p_visibility,
    CASE
      WHEN v_is_admin AND p_visibility = 'admins_only' THEN 'admin_internal'
      WHEN v_is_admin THEN 'admin_response'
      ELSE 'member_message'
    END,
    btrim(p_body)
  ) RETURNING id INTO v_message_id;

  IF NOT v_is_admin AND p_case_type = 'proposal' AND v_case_status = 'needs_info' THEN
    UPDATE public.leaderboard_competition_proposals
    SET status = 'pending',
        reviewed_by = NULL,
        reviewed_at = NULL
    WHERE id = p_case_id;
    v_reopened := true;
  END IF;

  IF v_is_admin THEN
    IF p_visibility = 'member_admins' THEN
      INSERT INTO public.leaderboard_notifications (
        recipient_user_id, proposal_id, participation_log_id, event_type, title, message
      ) VALUES (
        v_owner_id,
        CASE WHEN p_case_type = 'proposal' THEN p_case_id ELSE NULL END,
        CASE WHEN p_case_type = 'participation' THEN p_case_id ELSE NULL END,
        'case_message',
        'Pesan baru dari admin',
        left(btrim(p_body), 500)
      );
    ELSE
      INSERT INTO public.leaderboard_notifications (
        recipient_user_id, proposal_id, participation_log_id, event_type, title, message
      )
      SELECT
        role_row.user_id,
        CASE WHEN p_case_type = 'proposal' THEN p_case_id ELSE NULL END,
        CASE WHEN p_case_type = 'participation' THEN p_case_id ELSE NULL END,
        'admin_internal_note',
        'Catatan internal baru',
        left(btrim(p_body), 500)
      FROM public.user_roles role_row
      WHERE role_row.role = 'admin'
        AND role_row.user_id <> v_actor_id;
    END IF;
  ELSIF NOT v_reopened THEN
    INSERT INTO public.leaderboard_notifications (
      recipient_user_id, proposal_id, participation_log_id, event_type, title, message
    )
    SELECT
      role_row.user_id,
      CASE WHEN p_case_type = 'proposal' THEN p_case_id ELSE NULL END,
      CASE WHEN p_case_type = 'participation' THEN p_case_id ELSE NULL END,
      'case_message',
      'Pesan baru dari anggota',
      left(btrim(p_body), 500)
    FROM public.user_roles role_row
    WHERE role_row.role = 'admin'
      AND role_row.user_id <> v_actor_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message_id', v_message_id,
    'case_reopened', v_reopened
  );
END;
$$;

CREATE FUNCTION public.leaderboard_mark_notification_read(p_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.leaderboard_notifications
  SET is_read = true,
      read_at = COALESCE(read_at, now())
  WHERE id = p_notification_id
    AND recipient_user_id = v_user_id
    AND is_read = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'updated_count', v_updated);
END;
$$;

CREATE FUNCTION public.leaderboard_mark_all_notifications_read()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.leaderboard_notifications
  SET is_read = true,
      read_at = now()
  WHERE recipient_user_id = v_user_id
    AND is_read = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'updated_count', v_updated);
END;
$$;

-- Stage 7 adds an operator-safety contract without replacing the Stage 6 review RPC.
CREATE FUNCTION public.review_participation_v3(
  p_log_id uuid,
  p_status text,
  p_scoring_rule_id uuid,
  p_notes text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF p_status = 'rejected' AND NULLIF(btrim(p_notes), '') IS NULL THEN
    RAISE EXCEPTION 'Rejected submissions require a member-visible reason';
  END IF;

  RETURN public.review_participation_v2(
    p_log_id,
    p_status,
    p_scoring_rule_id,
    p_notes
  );
END;
$$;

CREATE FUNCTION public.leaderboard_delete_competition(
  p_competition_id uuid,
  p_confirmation_title text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_competition public.competitions%ROWTYPE;
  v_participation_count bigint;
  v_request_count bigint;
  v_proposal_count bigint;
BEGIN
  IF v_admin_id IS NULL
    OR NOT public.leaderboard_has_role(v_admin_id, 'admin')
  THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_competition
  FROM public.competitions
  WHERE id = p_competition_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Competition not found';
  END IF;
  IF v_competition.is_active THEN
    RAISE EXCEPTION 'Archive the competition before permanent deletion';
  END IF;
  IF btrim(COALESCE(p_confirmation_title, '')) IS DISTINCT FROM v_competition.title THEN
    RAISE EXCEPTION 'Competition title confirmation does not match';
  END IF;

  SELECT count(*) INTO v_participation_count
  FROM public.participation_logs
  WHERE competition_id = p_competition_id;

  SELECT count(*) INTO v_request_count
  FROM public.verification_requests
  WHERE competition_id = p_competition_id;

  SELECT count(*) INTO v_proposal_count
  FROM public.leaderboard_competition_proposals
  WHERE resolved_competition_id = p_competition_id;

  IF v_participation_count + v_request_count + v_proposal_count > 0 THEN
    RAISE EXCEPTION 'Competition has historical references and must remain archived';
  END IF;

  DELETE FROM public.competitions
  WHERE id = p_competition_id;

  RETURN jsonb_build_object(
    'success', true,
    'competition_id', p_competition_id,
    'deleted_title', v_competition.title
  );
END;
$$;

-- Replace destructive historical cascades with restrictive foreign keys.
DO $$
DECLARE
  v_target_table text;
  v_constraint_name text;
  v_delete_action "char";
BEGIN
  FOREACH v_target_table IN ARRAY ARRAY['participation_logs', 'verification_requests']
  LOOP
    SELECT constraint_row.conname, constraint_row.confdeltype
    INTO v_constraint_name, v_delete_action
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid = format('public.%I', v_target_table)::regclass
      AND constraint_row.confrelid = 'public.competitions'::regclass
      AND constraint_row.contype = 'f'
      AND (
        SELECT array_agg(attribute_row.attname::text ORDER BY attribute_row.attname::text)
        FROM unnest(constraint_row.conkey) AS key_row(attnum)
        JOIN pg_attribute attribute_row
          ON attribute_row.attrelid = constraint_row.conrelid
         AND attribute_row.attnum = key_row.attnum
      ) = ARRAY['competition_id']::text[];

    IF v_constraint_name IS NULL OR v_delete_action <> 'c'::"char" THEN
      RAISE EXCEPTION 'Expected one cascading competition foreign key on public.%', v_target_table;
    END IF;

    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_target_table, v_constraint_name);
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (competition_id) REFERENCES public.competitions(id) ON DELETE RESTRICT',
      v_target_table,
      v_constraint_name
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.leaderboard_add_case_message(text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leaderboard_mark_notification_read(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leaderboard_mark_all_notifications_read() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_participation_v3(uuid, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leaderboard_delete_competition(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leaderboard_add_case_message(text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard_mark_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard_mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_participation_v3(uuid, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard_delete_competition(uuid, text) TO authenticated;

COMMIT;
