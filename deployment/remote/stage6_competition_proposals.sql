-- ============================================================================
-- Stage 6: Member-sourced competition catalogue and competition tracks
-- Target: ARSC Leaderboard-owned objects only
-- Run manually in the Supabase SQL Editor after preflight and explicit approval.
-- This script is atomic and does not modify Rapor or Halo-owned objects.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_missing text;
  v_collisions text;
BEGIN
  SELECT string_agg(required_object, ', ' ORDER BY required_object)
  INTO v_missing
  FROM unnest(ARRAY[
    'public.competitions',
    'public.participation_logs',
    'public.participation_submission_events',
    'public.profiles',
    'public.arsc_identities',
    'public.leaderboard_scoring_templates',
    'public.leaderboard_scoring_template_rules',
    'public.leaderboard_competition_scoring_rules'
  ]) AS required_object
  WHERE to_regclass(required_object) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stage 6 prerequisites are missing: %', v_missing;
  END IF;

  SELECT string_agg(required_function, ', ' ORDER BY required_function)
  INTO v_missing
  FROM unnest(ARRAY[
    'public.leaderboard_has_role(uuid,public.app_role)',
    'public.leaderboard_update_updated_at()',
    'public.leaderboard_save_competition(uuid,text,date,text,text,boolean,uuid,jsonb)',
    'public.submit_participation_v2(uuid,uuid,text)',
    'public.review_participation_v2(uuid,text,uuid,text)'
  ]) AS required_function
  WHERE to_regprocedure(required_function) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stage 6 prerequisite functions are missing: %', v_missing;
  END IF;

  SELECT string_agg(object_name, ', ' ORDER BY object_name)
  INTO v_collisions
  FROM (
    SELECT table_name AS object_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'leaderboard_competition_tracks',
        'leaderboard_competition_proposals'
      )
    UNION ALL
    SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'leaderboard_save_competition_v2',
        'submit_participation_v3',
        'submit_competition_proposal',
        'review_competition_proposal',
        'get_public_member_participations_v3'
      )
  ) collisions;

  IF v_collisions IS NOT NULL THEN
    RAISE EXCEPTION 'Stage 6 namespace collision detected: %', v_collisions;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'participation_logs' AND column_name = 'competition_track_id')
        OR (
          table_name = 'participation_submission_events'
          AND column_name IN ('competition_track_id', 'competition_track_name')
        )
      )
  ) THEN
    RAISE EXCEPTION 'Stage 6 column collision detected';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.leaderboard_scoring_templates
    WHERE code = 'internal-arsc'
       OR id = '00000000-0000-4000-8000-000000000507'::uuid
  ) THEN
    RAISE EXCEPTION 'Internal ARSC preset collision detected';
  END IF;
END;
$$;

CREATE TABLE public.leaderboard_competition_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leaderboard_competition_tracks_name_check
    CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT leaderboard_competition_tracks_description_check
    CHECK (description IS NULL OR length(description) <= 1000)
);

CREATE UNIQUE INDEX leaderboard_competition_tracks_name_key
  ON public.leaderboard_competition_tracks (competition_id, lower(btrim(name)));

CREATE INDEX leaderboard_competition_tracks_active_idx
  ON public.leaderboard_competition_tracks (competition_id, is_active, name);

CREATE TRIGGER leaderboard_competition_tracks_updated_at
BEFORE UPDATE ON public.leaderboard_competition_tracks
FOR EACH ROW EXECUTE FUNCTION public.leaderboard_update_updated_at();

INSERT INTO public.leaderboard_competition_tracks (competition_id, name)
SELECT id, 'Umum'
FROM public.competitions;

ALTER TABLE public.participation_logs
  ADD COLUMN competition_track_id uuid
    REFERENCES public.leaderboard_competition_tracks(id) ON DELETE RESTRICT;

UPDATE public.participation_logs pl
SET competition_track_id = track.id
FROM public.leaderboard_competition_tracks track
WHERE track.competition_id = pl.competition_id
  AND lower(btrim(track.name)) = 'umum';

ALTER TABLE public.participation_logs
  ALTER COLUMN competition_track_id SET NOT NULL;

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT con.conname
  INTO v_constraint_name
  FROM pg_constraint con
  WHERE con.conrelid = 'public.participation_logs'::regclass
    AND con.contype = 'u'
    AND (
      SELECT array_agg(att.attname::text ORDER BY att.attname::text)
      FROM unnest(con.conkey) AS key(attnum)
      JOIN pg_attribute att
        ON att.attrelid = con.conrelid
       AND att.attnum = key.attnum
    ) = ARRAY['competition_id', 'profile_id']::text[];

  IF v_constraint_name IS NULL THEN
    RAISE EXCEPTION 'Expected participation_logs profile/competition uniqueness constraint was not found';
  END IF;

  EXECUTE format(
    'ALTER TABLE public.participation_logs DROP CONSTRAINT %I',
    v_constraint_name
  );
END;
$$;

ALTER TABLE public.participation_logs
  ADD CONSTRAINT participation_logs_profile_competition_track_key
  UNIQUE (profile_id, competition_id, competition_track_id);

ALTER TABLE public.participation_submission_events
  ADD COLUMN competition_track_id uuid
    REFERENCES public.leaderboard_competition_tracks(id) ON DELETE SET NULL,
  ADD COLUMN competition_track_name text;

UPDATE public.participation_submission_events event
SET competition_track_id = pl.competition_track_id,
    competition_track_name = track.name
FROM public.participation_logs pl
JOIN public.leaderboard_competition_tracks track
  ON track.id = pl.competition_track_id
WHERE pl.id = event.log_id;

ALTER TABLE public.participation_submission_events
  ADD CONSTRAINT participation_submission_events_track_name_check
  CHECK (
    competition_track_name IS NULL
    OR length(btrim(competition_track_name)) BETWEEN 1 AND 120
  );

CREATE TABLE public.leaderboard_competition_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  proposed_title text NOT NULL,
  proposed_organizer text NOT NULL,
  information_url text NOT NULL,
  proposed_date date,
  proposed_level text NOT NULL,
  proposed_track_name text NOT NULL DEFAULT 'Umum',
  proposed_achievement text NOT NULL,
  evidence_url text NOT NULL,
  member_notes text,
  status text NOT NULL DEFAULT 'pending',
  review_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  resolved_competition_id uuid REFERENCES public.competitions(id) ON DELETE SET NULL,
  resolved_track_id uuid REFERENCES public.leaderboard_competition_tracks(id) ON DELETE SET NULL,
  resolved_scoring_rule_id uuid REFERENCES public.leaderboard_competition_scoring_rules(id) ON DELETE SET NULL,
  participation_log_id uuid REFERENCES public.participation_logs(id) ON DELETE SET NULL,
  resolution_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leaderboard_competition_proposals_title_check
    CHECK (length(btrim(proposed_title)) BETWEEN 1 AND 160),
  CONSTRAINT leaderboard_competition_proposals_organizer_check
    CHECK (length(btrim(proposed_organizer)) BETWEEN 1 AND 160),
  CONSTRAINT leaderboard_competition_proposals_information_url_check
    CHECK (information_url ~* '^https://[^[:space:]]+$' AND length(information_url) <= 2048),
  CONSTRAINT leaderboard_competition_proposals_level_check
    CHECK (length(btrim(proposed_level)) BETWEEN 1 AND 80),
  CONSTRAINT leaderboard_competition_proposals_track_check
    CHECK (length(btrim(proposed_track_name)) BETWEEN 1 AND 120),
  CONSTRAINT leaderboard_competition_proposals_achievement_check
    CHECK (length(btrim(proposed_achievement)) BETWEEN 1 AND 120),
  CONSTRAINT leaderboard_competition_proposals_evidence_url_check
    CHECK (evidence_url ~* '^https://[^[:space:]]+$' AND length(evidence_url) <= 2048),
  CONSTRAINT leaderboard_competition_proposals_notes_check
    CHECK (member_notes IS NULL OR length(member_notes) <= 2000),
  CONSTRAINT leaderboard_competition_proposals_review_notes_check
    CHECK (review_notes IS NULL OR length(review_notes) <= 2000),
  CONSTRAINT leaderboard_competition_proposals_status_check
    CHECK (status IN ('pending', 'needs_info', 'accepted', 'rejected')),
  CONSTRAINT leaderboard_competition_proposals_resolution_check
    CHECK (
      resolution_type IS NULL
      OR resolution_type IN (
        'created_competition',
        'existing_competition',
        'added_track',
        'existing_track'
      )
    )
);

CREATE INDEX leaderboard_competition_proposals_owner_idx
  ON public.leaderboard_competition_proposals (submitted_by, created_at DESC);

CREATE INDEX leaderboard_competition_proposals_review_idx
  ON public.leaderboard_competition_proposals (status, created_at);

CREATE UNIQUE INDEX leaderboard_competition_proposals_open_key
  ON public.leaderboard_competition_proposals (
    profile_id,
    lower(btrim(proposed_title)),
    lower(btrim(proposed_track_name))
  )
  WHERE status IN ('pending', 'needs_info');

CREATE TRIGGER leaderboard_competition_proposals_updated_at
BEFORE UPDATE ON public.leaderboard_competition_proposals
FOR EACH ROW EXECUTE FUNCTION public.leaderboard_update_updated_at();

ALTER TABLE public.leaderboard_competition_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_competition_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tracks are publicly readable"
ON public.leaderboard_competition_tracks
FOR SELECT
USING (true);

CREATE POLICY "Members can view their proposals"
ON public.leaderboard_competition_proposals
FOR SELECT
TO authenticated
USING (submitted_by = auth.uid());

CREATE POLICY "Admins can view all competition proposals"
ON public.leaderboard_competition_proposals
FOR SELECT
TO authenticated
USING (public.leaderboard_has_role(auth.uid(), 'admin'));

REVOKE ALL ON public.leaderboard_competition_tracks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.leaderboard_competition_proposals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.leaderboard_competition_tracks TO anon, authenticated;
GRANT SELECT ON public.leaderboard_competition_proposals TO authenticated;
GRANT ALL ON public.leaderboard_competition_tracks TO postgres, service_role;
GRANT ALL ON public.leaderboard_competition_proposals TO postgres, service_role;

INSERT INTO public.leaderboard_scoring_templates
  (id, code, name, description, suggested_category, is_system)
VALUES (
  '00000000-0000-4000-8000-000000000507',
  'internal-arsc',
  'Internal ARSC — Lomba Wajib',
  'Preset ringkas untuk lomba wajib internal ARSC. Nilai dapat diedit untuk setiap kompetisi.',
  'Internal ARSC',
  true
);

INSERT INTO public.leaderboard_scoring_template_rules
  (template_id, label, points, sort_order)
VALUES
  ('00000000-0000-4000-8000-000000000507', 'Juara 1', 15, 10),
  ('00000000-0000-4000-8000-000000000507', 'Juara 2', 12, 20),
  ('00000000-0000-4000-8000-000000000507', 'Juara 3', 10, 30),
  ('00000000-0000-4000-8000-000000000507', 'Finalis', 6, 40),
  ('00000000-0000-4000-8000-000000000507', 'Peserta', 2, 50);

CREATE FUNCTION public.leaderboard_save_competition_v2(
  p_competition_id uuid,
  p_title text,
  p_date date,
  p_description text,
  p_category text,
  p_is_active boolean,
  p_template_id uuid,
  p_rules jsonb,
  p_tracks jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_competition_id uuid;
  v_tracks jsonb := p_tracks;
  v_track jsonb;
  v_track_id uuid;
  v_track_name text;
  v_track_description text;
  v_track_count integer;
  v_unique_track_count integer;
BEGIN
  IF auth.uid() IS NULL
    OR NOT public.leaderboard_has_role(auth.uid(), 'admin')
  THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_result := public.leaderboard_save_competition(
    p_competition_id,
    p_title,
    p_date,
    p_description,
    p_category,
    p_is_active,
    p_template_id,
    p_rules
  );
  v_competition_id := (v_result->>'competition_id')::uuid;

  IF v_tracks IS NULL OR v_tracks = '[]'::jsonb THEN
    v_tracks := jsonb_build_array(jsonb_build_object('name', 'Umum'));
  END IF;

  IF jsonb_typeof(v_tracks) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Competition tracks must be a JSON array';
  END IF;

  SELECT count(*), count(DISTINCT lower(btrim(value->>'name')))
  INTO v_track_count, v_unique_track_count
  FROM jsonb_array_elements(v_tracks);

  IF v_track_count NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'A competition requires 1 to 100 tracks';
  END IF;
  IF v_unique_track_count <> v_track_count THEN
    RAISE EXCEPTION 'Competition track names must be unique';
  END IF;

  UPDATE public.leaderboard_competition_tracks
  SET is_active = false
  WHERE competition_id = v_competition_id;

  FOR v_track IN SELECT value FROM jsonb_array_elements(v_tracks)
  LOOP
    v_track_name := btrim(v_track->>'name');
    v_track_description := NULLIF(btrim(v_track->>'description'), '');

    IF v_track_name IS NULL OR length(v_track_name) NOT BETWEEN 1 AND 120 THEN
      RAISE EXCEPTION 'Every track name must contain 1 to 120 characters';
    END IF;
    IF v_track_description IS NOT NULL AND length(v_track_description) > 1000 THEN
      RAISE EXCEPTION 'Track description for % exceeds 1000 characters', v_track_name;
    END IF;

    v_track_id := NULL;
    IF NULLIF(v_track->>'id', '') IS NOT NULL THEN
      BEGIN
        v_track_id := (v_track->>'id')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Invalid track identifier for %', v_track_name;
      END;

      UPDATE public.leaderboard_competition_tracks
      SET name = v_track_name,
          description = v_track_description,
          is_active = true
      WHERE id = v_track_id
        AND competition_id = v_competition_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Track % does not belong to this competition', v_track_id;
      END IF;
    ELSE
      SELECT id INTO v_track_id
      FROM public.leaderboard_competition_tracks
      WHERE competition_id = v_competition_id
        AND lower(btrim(name)) = lower(v_track_name)
      LIMIT 1;

      IF v_track_id IS NULL THEN
        INSERT INTO public.leaderboard_competition_tracks (
          competition_id,
          name,
          description,
          is_active
        ) VALUES (
          v_competition_id,
          v_track_name,
          v_track_description,
          true
        );
      ELSE
        UPDATE public.leaderboard_competition_tracks
        SET name = v_track_name,
            description = v_track_description,
            is_active = true
        WHERE id = v_track_id;
      END IF;
    END IF;
  END LOOP;

  RETURN v_result || jsonb_build_object('track_count', v_track_count);
END;
$$;

CREATE FUNCTION public.submit_participation_v3(
  p_competition_id uuid,
  p_competition_track_id uuid,
  p_scoring_rule_id uuid,
  p_evidence_url text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_rule public.leaderboard_competition_scoring_rules%ROWTYPE;
  v_track public.leaderboard_competition_tracks%ROWTYPE;
  v_existing_log public.participation_logs%ROWTYPE;
  v_log_id uuid;
  v_trimmed_url text := btrim(p_evidence_url);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF v_trimmed_url IS NULL
    OR v_trimmed_url !~* '^https://[^[:space:]]+$'
    OR length(v_trimmed_url) > 2048
  THEN
    RAISE EXCEPTION 'Evidence URL must be a valid HTTPS URL';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_profile.link_status NOT IN ('linked_exact', 'manually_linked')
    OR v_profile.member_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.arsc_identities identity_row
      WHERE identity_row.auth_user_id = v_user_id
        AND identity_row.member_id = v_profile.member_id
    )
  THEN
    RAISE EXCEPTION 'Identity not securely linked';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.competitions competition
    WHERE competition.id = p_competition_id
      AND competition.is_active = true
  ) THEN
    RAISE EXCEPTION 'Competition is not available for submissions';
  END IF;

  SELECT * INTO v_track
  FROM public.leaderboard_competition_tracks
  WHERE id = p_competition_track_id
    AND competition_id = p_competition_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Competition track is not available for submissions';
  END IF;

  SELECT * INTO v_rule
  FROM public.leaderboard_competition_scoring_rules
  WHERE id = p_scoring_rule_id
    AND competition_id = p_competition_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scoring option is not available for this competition';
  END IF;

  SELECT * INTO v_existing_log
  FROM public.participation_logs
  WHERE profile_id = v_profile.id
    AND competition_id = p_competition_id
    AND competition_track_id = p_competition_track_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing_log.status IN ('pending', 'approved') THEN
      RAISE EXCEPTION 'Submission is already pending or approved for this competition track';
    END IF;

    UPDATE public.participation_logs
    SET status = 'pending',
        evidence_url = v_trimmed_url,
        requested_scoring_rule_id = v_rule.id,
        requested_achievement = v_rule.label,
        requested_points = v_rule.points,
        awarded_scoring_rule_id = NULL,
        awarded_achievement = NULL,
        awarded_points = NULL,
        admin_id = NULL,
        verified_at = NULL,
        notes = NULL
    WHERE id = v_existing_log.id
    RETURNING id INTO v_log_id;
  ELSE
    INSERT INTO public.participation_logs (
      profile_id,
      competition_id,
      competition_track_id,
      evidence_url,
      status,
      requested_scoring_rule_id,
      requested_achievement,
      requested_points
    ) VALUES (
      v_profile.id,
      p_competition_id,
      p_competition_track_id,
      v_trimmed_url,
      'pending',
      v_rule.id,
      v_rule.label,
      v_rule.points
    ) RETURNING id INTO v_log_id;
  END IF;

  INSERT INTO public.participation_submission_events (
    log_id,
    from_status,
    to_status,
    actor_user_id,
    actor_role,
    evidence_url,
    scoring_rule_id,
    achievement,
    competition_track_id,
    competition_track_name
  ) VALUES (
    v_log_id,
    CASE WHEN v_existing_log.id IS NULL THEN NULL ELSE 'rejected' END,
    'pending',
    v_user_id,
    'user',
    v_trimmed_url,
    v_rule.id,
    v_rule.label,
    v_track.id,
    v_track.name
  );

  RETURN jsonb_build_object(
    'success', true,
    'log_id', v_log_id,
    'action', CASE WHEN v_existing_log.id IS NULL THEN 'submitted' ELSE 'resubmitted' END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_participation_v2(
  p_competition_id uuid,
  p_scoring_rule_id uuid,
  p_evidence_url text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_track_id uuid;
BEGIN
  SELECT id INTO v_track_id
  FROM public.leaderboard_competition_tracks
  WHERE competition_id = p_competition_id
    AND is_active = true
  ORDER BY
    CASE WHEN lower(btrim(name)) = 'umum' THEN 0 ELSE 1 END,
    created_at,
    id
  LIMIT 1;

  IF v_track_id IS NULL THEN
    RAISE EXCEPTION 'Competition has no active track';
  END IF;

  RETURN public.submit_participation_v3(
    p_competition_id,
    v_track_id,
    p_scoring_rule_id,
    p_evidence_url
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.review_participation_v2(
  p_log_id uuid,
  p_status text,
  p_scoring_rule_id uuid,
  p_notes text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_log public.participation_logs%ROWTYPE;
  v_rule public.leaderboard_competition_scoring_rules%ROWTYPE;
  v_track public.leaderboard_competition_tracks%ROWTYPE;
BEGIN
  IF v_admin_id IS NULL
    OR NOT public.leaderboard_has_role(v_admin_id, 'admin')
  THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid review status';
  END IF;
  IF p_notes IS NOT NULL AND length(p_notes) > 2000 THEN
    RAISE EXCEPTION 'Review notes exceed 2000 characters';
  END IF;
  IF p_status = 'approved' AND p_scoring_rule_id IS NULL THEN
    RAISE EXCEPTION 'Approved submissions require a scoring option';
  END IF;
  IF p_status = 'rejected' AND p_scoring_rule_id IS NOT NULL THEN
    RAISE EXCEPTION 'Rejected submissions cannot receive a scoring option';
  END IF;

  SELECT * INTO v_log
  FROM public.participation_logs
  WHERE id = p_log_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  SELECT * INTO v_track
  FROM public.leaderboard_competition_tracks
  WHERE id = v_log.competition_track_id;

  IF p_status = 'approved' THEN
    SELECT * INTO v_rule
    FROM public.leaderboard_competition_scoring_rules
    WHERE id = p_scoring_rule_id
      AND competition_id = v_log.competition_id
      AND (is_active = true OR id = v_log.requested_scoring_rule_id);

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Scoring option does not belong to this competition or is inactive';
    END IF;
  END IF;

  IF v_log.status = p_status THEN
    IF v_log.awarded_scoring_rule_id IS NOT DISTINCT FROM p_scoring_rule_id
      AND v_log.notes IS NOT DISTINCT FROM NULLIF(btrim(p_notes), '')
    THEN
      RETURN jsonb_build_object('success', true, 'log_id', p_log_id, 'action', 'idempotent');
    END IF;
    RAISE EXCEPTION 'Submission is already %, and approved/rejected records are immutable', p_status;
  END IF;
  IF v_log.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Only pending submissions can be reviewed';
  END IF;

  UPDATE public.participation_logs
  SET status = p_status,
      awarded_scoring_rule_id = CASE WHEN p_status = 'approved' THEN v_rule.id ELSE NULL END,
      awarded_achievement = CASE WHEN p_status = 'approved' THEN v_rule.label ELSE NULL END,
      awarded_points = CASE WHEN p_status = 'approved' THEN v_rule.points ELSE NULL END,
      notes = NULLIF(btrim(p_notes), ''),
      admin_id = v_admin_id,
      verified_at = now()
  WHERE id = p_log_id;

  INSERT INTO public.participation_submission_events (
    log_id,
    from_status,
    to_status,
    actor_user_id,
    actor_role,
    evidence_url,
    awarded_points,
    notes,
    scoring_rule_id,
    achievement,
    competition_track_id,
    competition_track_name
  ) VALUES (
    p_log_id,
    'pending',
    p_status,
    v_admin_id,
    'admin',
    v_log.evidence_url,
    CASE WHEN p_status = 'approved' THEN v_rule.points ELSE NULL END,
    NULLIF(btrim(p_notes), ''),
    CASE WHEN p_status = 'approved' THEN v_rule.id ELSE NULL END,
    CASE WHEN p_status = 'approved' THEN v_rule.label ELSE NULL END,
    v_track.id,
    v_track.name
  );

  RETURN jsonb_build_object(
    'success', true,
    'log_id', p_log_id,
    'action', p_status,
    'achievement', CASE WHEN p_status = 'approved' THEN v_rule.label ELSE NULL END,
    'awarded_points', CASE WHEN p_status = 'approved' THEN v_rule.points ELSE NULL END
  );
END;
$$;

CREATE FUNCTION public.submit_competition_proposal(
  p_title text,
  p_organizer text,
  p_information_url text,
  p_date date,
  p_level text,
  p_track_name text,
  p_achievement text,
  p_evidence_url text,
  p_member_notes text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_proposal_id uuid;
  v_action text := 'submitted';
  v_title text := btrim(p_title);
  v_track_name text := COALESCE(NULLIF(btrim(p_track_name), ''), 'Umum');
  v_information_url text := btrim(p_information_url);
  v_evidence_url text := btrim(p_evidence_url);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF NOT FOUND
    OR v_profile.link_status NOT IN ('linked_exact', 'manually_linked')
    OR v_profile.member_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.arsc_identities identity_row
      WHERE identity_row.auth_user_id = v_user_id
        AND identity_row.member_id = v_profile.member_id
    )
  THEN
    RAISE EXCEPTION 'Identity not securely linked';
  END IF;

  IF v_title IS NULL OR length(v_title) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'Competition title must contain 1 to 160 characters';
  END IF;
  IF NULLIF(btrim(p_organizer), '') IS NULL OR length(btrim(p_organizer)) > 160 THEN
    RAISE EXCEPTION 'Organizer must contain 1 to 160 characters';
  END IF;
  IF v_information_url IS NULL
    OR v_information_url !~* '^https://[^[:space:]]+$'
    OR length(v_information_url) > 2048
  THEN
    RAISE EXCEPTION 'Official information URL must be a valid HTTPS URL';
  END IF;
  IF NULLIF(btrim(p_level), '') IS NULL OR length(btrim(p_level)) > 80 THEN
    RAISE EXCEPTION 'Competition level must contain 1 to 80 characters';
  END IF;
  IF length(v_track_name) > 120 THEN
    RAISE EXCEPTION 'Competition track exceeds 120 characters';
  END IF;
  IF NULLIF(btrim(p_achievement), '') IS NULL OR length(btrim(p_achievement)) > 120 THEN
    RAISE EXCEPTION 'Proposed achievement must contain 1 to 120 characters';
  END IF;
  IF v_evidence_url IS NULL
    OR v_evidence_url !~* '^https://[^[:space:]]+$'
    OR length(v_evidence_url) > 2048
  THEN
    RAISE EXCEPTION 'Evidence URL must be a valid HTTPS URL';
  END IF;
  IF p_member_notes IS NOT NULL AND length(p_member_notes) > 2000 THEN
    RAISE EXCEPTION 'Member notes exceed 2000 characters';
  END IF;

  SELECT id INTO v_proposal_id
  FROM public.leaderboard_competition_proposals
  WHERE profile_id = v_profile.id
    AND lower(btrim(proposed_title)) = lower(v_title)
    AND lower(btrim(proposed_track_name)) = lower(v_track_name)
    AND status IN ('pending', 'needs_info')
  FOR UPDATE;

  IF v_proposal_id IS NULL THEN
    INSERT INTO public.leaderboard_competition_proposals (
      submitted_by,
      profile_id,
      proposed_title,
      proposed_organizer,
      information_url,
      proposed_date,
      proposed_level,
      proposed_track_name,
      proposed_achievement,
      evidence_url,
      member_notes
    ) VALUES (
      v_user_id,
      v_profile.id,
      v_title,
      btrim(p_organizer),
      v_information_url,
      p_date,
      btrim(p_level),
      v_track_name,
      btrim(p_achievement),
      v_evidence_url,
      NULLIF(btrim(p_member_notes), '')
    ) RETURNING id INTO v_proposal_id;
  ELSE
    UPDATE public.leaderboard_competition_proposals
    SET proposed_organizer = btrim(p_organizer),
        information_url = v_information_url,
        proposed_date = p_date,
        proposed_level = btrim(p_level),
        proposed_achievement = btrim(p_achievement),
        evidence_url = v_evidence_url,
        member_notes = NULLIF(btrim(p_member_notes), ''),
        status = 'pending',
        review_notes = NULL,
        reviewed_by = NULL,
        reviewed_at = NULL
    WHERE id = v_proposal_id;
    v_action := 'resubmitted';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'proposal_id', v_proposal_id,
    'action', v_action
  );
END;
$$;

CREATE FUNCTION public.review_competition_proposal(
  p_proposal_id uuid,
  p_status text,
  p_review_notes text,
  p_competition_id uuid,
  p_title text,
  p_date date,
  p_description text,
  p_category text,
  p_is_active boolean,
  p_template_id uuid,
  p_rules jsonb,
  p_tracks jsonb,
  p_track_id uuid,
  p_track_name text,
  p_scoring_rule_label text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_proposal public.leaderboard_competition_proposals%ROWTYPE;
  v_competition_id uuid := p_competition_id;
  v_track_id uuid := p_track_id;
  v_track_name text := COALESCE(NULLIF(btrim(p_track_name), ''), 'Umum');
  v_rule public.leaderboard_competition_scoring_rules%ROWTYPE;
  v_existing_log public.participation_logs%ROWTYPE;
  v_log_id uuid;
  v_result jsonb;
  v_created_competition boolean := false;
  v_created_track boolean := false;
BEGIN
  IF v_admin_id IS NULL
    OR NOT public.leaderboard_has_role(v_admin_id, 'admin')
  THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_status NOT IN ('needs_info', 'accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid proposal review status';
  END IF;
  IF p_review_notes IS NOT NULL AND length(p_review_notes) > 2000 THEN
    RAISE EXCEPTION 'Review notes exceed 2000 characters';
  END IF;
  IF p_status IN ('needs_info', 'rejected')
    AND NULLIF(btrim(p_review_notes), '') IS NULL
  THEN
    RAISE EXCEPTION 'Review notes are required when requesting information or rejecting';
  END IF;

  SELECT * INTO v_proposal
  FROM public.leaderboard_competition_proposals
  WHERE id = p_proposal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Competition proposal not found';
  END IF;
  IF v_proposal.status NOT IN ('pending', 'needs_info') THEN
    RAISE EXCEPTION 'Competition proposal is already finalized';
  END IF;

  IF p_status IN ('needs_info', 'rejected') THEN
    UPDATE public.leaderboard_competition_proposals
    SET status = p_status,
        review_notes = btrim(p_review_notes),
        reviewed_by = v_admin_id,
        reviewed_at = now()
    WHERE id = p_proposal_id;

    RETURN jsonb_build_object(
      'success', true,
      'proposal_id', p_proposal_id,
      'action', p_status
    );
  END IF;

  IF v_competition_id IS NULL THEN
    v_result := public.leaderboard_save_competition_v2(
      NULL,
      p_title,
      p_date,
      p_description,
      p_category,
      COALESCE(p_is_active, true),
      p_template_id,
      p_rules,
      COALESCE(
        p_tracks,
        jsonb_build_array(jsonb_build_object('name', v_track_name))
      )
    );
    v_competition_id := (v_result->>'competition_id')::uuid;
    v_created_competition := true;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.competitions WHERE id = v_competition_id) THEN
      RAISE EXCEPTION 'Resolved competition does not exist';
    END IF;
  END IF;

  IF v_track_id IS NOT NULL THEN
    SELECT id, name INTO v_track_id, v_track_name
    FROM public.leaderboard_competition_tracks
    WHERE id = v_track_id
      AND competition_id = v_competition_id
      AND is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Resolved competition track is unavailable';
    END IF;
  ELSE
    SELECT id INTO v_track_id
    FROM public.leaderboard_competition_tracks
    WHERE competition_id = v_competition_id
      AND lower(btrim(name)) = lower(v_track_name)
    LIMIT 1;

    IF v_track_id IS NULL THEN
      INSERT INTO public.leaderboard_competition_tracks (
        competition_id,
        name,
        is_active
      ) VALUES (
        v_competition_id,
        v_track_name,
        true
      ) RETURNING id INTO v_track_id;
      v_created_track := true;
    ELSE
      UPDATE public.leaderboard_competition_tracks
      SET is_active = true
      WHERE id = v_track_id;
    END IF;
  END IF;

  SELECT * INTO v_rule
  FROM public.leaderboard_competition_scoring_rules
  WHERE competition_id = v_competition_id
    AND lower(btrim(label)) = lower(btrim(p_scoring_rule_label))
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resolved scoring rule is unavailable for the competition';
  END IF;

  SELECT * INTO v_existing_log
  FROM public.participation_logs
  WHERE profile_id = v_proposal.profile_id
    AND competition_id = v_competition_id
    AND competition_track_id = v_track_id
  FOR UPDATE;

  IF FOUND AND v_existing_log.status IN ('pending', 'approved') THEN
    RAISE EXCEPTION 'Member already has a pending or approved submission for this competition track';
  END IF;

  IF FOUND THEN
    UPDATE public.participation_logs
    SET status = 'pending',
        evidence_url = v_proposal.evidence_url,
        requested_scoring_rule_id = v_rule.id,
        requested_achievement = v_rule.label,
        requested_points = v_rule.points,
        awarded_scoring_rule_id = NULL,
        awarded_achievement = NULL,
        awarded_points = NULL,
        admin_id = NULL,
        verified_at = NULL,
        notes = NULL
    WHERE id = v_existing_log.id
    RETURNING id INTO v_log_id;
  ELSE
    INSERT INTO public.participation_logs (
      profile_id,
      competition_id,
      competition_track_id,
      evidence_url,
      status,
      requested_scoring_rule_id,
      requested_achievement,
      requested_points
    ) VALUES (
      v_proposal.profile_id,
      v_competition_id,
      v_track_id,
      v_proposal.evidence_url,
      'pending',
      v_rule.id,
      v_rule.label,
      v_rule.points
    ) RETURNING id INTO v_log_id;
  END IF;

  INSERT INTO public.participation_submission_events (
    log_id,
    from_status,
    to_status,
    actor_user_id,
    actor_role,
    evidence_url,
    notes,
    scoring_rule_id,
    achievement,
    competition_track_id,
    competition_track_name
  ) VALUES (
    v_log_id,
    CASE WHEN v_existing_log.id IS NULL THEN NULL ELSE 'rejected' END,
    'pending',
    v_proposal.submitted_by,
    'user',
    v_proposal.evidence_url,
    'Created from accepted competition proposal',
    v_rule.id,
    v_rule.label,
    v_track_id,
    v_track_name
  );

  UPDATE public.leaderboard_competition_proposals
  SET status = 'accepted',
      review_notes = NULLIF(btrim(p_review_notes), ''),
      reviewed_by = v_admin_id,
      reviewed_at = now(),
      resolved_competition_id = v_competition_id,
      resolved_track_id = v_track_id,
      resolved_scoring_rule_id = v_rule.id,
      participation_log_id = v_log_id,
      resolution_type = CASE
        WHEN v_created_competition THEN 'created_competition'
        WHEN v_created_track THEN 'added_track'
        WHEN p_track_id IS NOT NULL THEN 'existing_track'
        ELSE 'existing_competition'
      END
  WHERE id = p_proposal_id;

  RETURN jsonb_build_object(
    'success', true,
    'proposal_id', p_proposal_id,
    'competition_id', v_competition_id,
    'competition_track_id', v_track_id,
    'participation_log_id', v_log_id,
    'action', 'accepted'
  );
END;
$$;

CREATE FUNCTION public.get_public_member_participations_v3(p_profile_id uuid)
RETURNS TABLE (
  participation_id uuid,
  competition_id uuid,
  competition_title text,
  competition_date date,
  competition_category text,
  competition_track_id uuid,
  competition_track_name text,
  achievement text,
  awarded_points integer,
  participation_date timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    log.id,
    competition.id,
    competition.title,
    competition.date,
    competition.category,
    track.id,
    track.name,
    log.awarded_achievement,
    COALESCE(log.awarded_points, 0),
    log.participation_date,
    log.created_at
  FROM public.participation_logs log
  INNER JOIN public.competitions competition ON competition.id = log.competition_id
  INNER JOIN public.leaderboard_competition_tracks track ON track.id = log.competition_track_id
  INNER JOIN public.profiles profile ON profile.id = log.profile_id
  INNER JOIN public.arsc_identities identity_row
    ON identity_row.auth_user_id = profile.user_id
   AND identity_row.member_id = profile.member_id
  WHERE log.profile_id = p_profile_id
    AND log.status = 'approved'
    AND profile.link_status IN ('linked_exact', 'manually_linked')
  ORDER BY COALESCE(log.participation_date, log.created_at) DESC;
$$;

REVOKE ALL ON FUNCTION public.leaderboard_save_competition_v2(uuid, text, date, text, text, boolean, uuid, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_participation_v3(uuid, uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_competition_proposal(text, text, text, date, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_competition_proposal(uuid, text, text, uuid, text, date, text, text, boolean, uuid, jsonb, jsonb, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_public_member_participations_v3(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.leaderboard_save_competition_v2(uuid, text, date, text, text, boolean, uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_participation_v3(uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_competition_proposal(text, text, text, date, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_competition_proposal(uuid, text, text, uuid, text, date, text, text, boolean, uuid, jsonb, jsonb, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_member_participations_v3(uuid) TO anon, authenticated, service_role;

DO $$
BEGIN
  RAISE NOTICE 'Stage 6 competition proposal and track flow deployed successfully.';
END;
$$;

COMMIT;
