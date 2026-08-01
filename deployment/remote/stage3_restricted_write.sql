-- ==============================================================================
-- Stage 3: Restricted Write Architecture (Remote Deployment)
-- Execute via Supabase Dashboard SQL Editor AFTER leaderboard_bootstrap_schema.sql
-- MUST RUN INSIDE AN EXPLICIT TRANSACTION.
-- ==============================================================================

BEGIN;

-- 1. Dependency & Stage 3 Compatibility Checks
DO $$
DECLARE
    v_missing_cols TEXT;
    v_duplicate_logs INT;
    v_col_type TEXT;
    v_exists BOOLEAN;
    v_events_schema TEXT;
BEGIN
    RAISE NOTICE '--- INITIATING STAGE 3 PRE-EXECUTION VALIDATION ---';

    -- Check for required base exact columns
    SELECT string_agg(req.req_table || '.' || req.req_column, ', ')
    INTO v_missing_cols
    FROM (
        VALUES 
            ('profiles', 'id'), ('profiles', 'user_id'), ('profiles', 'member_id'),
            ('user_roles', 'user_id'), ('user_roles', 'role'),
            ('competitions', 'id'),
            ('participation_logs', 'id'), ('participation_logs', 'profile_id'), ('participation_logs', 'competition_id'),
            ('members', 'id'),
            ('member_release_links', 'member_id'), ('member_release_links', 'release_member_code'), ('profiles', 'link_status')
    ) AS req(req_table, req_column)
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' 
          AND c.table_name = req.req_table 
          AND c.column_name = req.req_column
    );

    IF v_missing_cols IS NOT NULL THEN
        RAISE EXCEPTION 'Dependency Verification Failed. Missing required base columns: %', v_missing_cols;
    END IF;

    -- Check duplicate submissions that violate UNIQUE(profile_id, competition_id)
    SELECT count(*) INTO v_duplicate_logs
    FROM (
        SELECT profile_id, competition_id
        FROM public.participation_logs
        GROUP BY profile_id, competition_id
        HAVING count(*) > 1
    ) dupes;
    IF v_duplicate_logs > 0 THEN
        RAISE EXCEPTION 'Dependency Verification Failed. Found % duplicate submission pairs.', v_duplicate_logs;
    END IF;

    -- Stage 3 Column exact matching if they already exist
    -- participation_logs.status
    SELECT data_type INTO v_col_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'participation_logs' AND column_name = 'status';
    IF v_col_type IS NOT NULL THEN
        IF v_col_type != 'text' THEN RAISE EXCEPTION 'participation_logs.status exists but is not text.'; END IF;
    END IF;

    -- participation_logs.awarded_points
    SELECT data_type INTO v_col_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'participation_logs' AND column_name = 'awarded_points';
    IF v_col_type IS NOT NULL THEN
        IF v_col_type != 'integer' THEN RAISE EXCEPTION 'participation_logs.awarded_points exists but is not integer.'; END IF;
    END IF;

    -- participation_submission_events validation
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'participation_submission_events') INTO v_exists;
    IF v_exists THEN
        SELECT string_agg(column_name || ':' || data_type || ':' || is_nullable, ',' ORDER BY column_name) INTO v_events_schema
        FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'participation_submission_events';
        IF v_events_schema != 'actor_role:text:NO,actor_user_id:uuid:NO,awarded_points:integer:YES,created_at:timestamp with time zone:NO,evidence_url:text:YES,from_status:text:YES,id:uuid:NO,log_id:uuid:NO,notes:text:YES,to_status:text:NO' THEN
            RAISE EXCEPTION 'participation_submission_events exists but is incompatible. Found: %', v_events_schema;
        END IF;
    END IF;

    RAISE NOTICE 'Stage 3 Validation Passed.';
END $$;

-- 2. Revoke excessive anonymous read access
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.user_roles FROM anon;

-- 3. Evolve participation_logs functionally safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'participation_logs' AND column_name = 'status') THEN
        ALTER TABLE public.participation_logs ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
        ALTER TABLE public.participation_logs ADD CONSTRAINT participation_logs_status_check CHECK (status IN ('pending', 'approved', 'rejected'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'participation_logs' AND column_name = 'awarded_points') THEN
        ALTER TABLE public.participation_logs ADD COLUMN awarded_points INTEGER;
    END IF;
END $$;

-- Drop permissive write and read policies on participation_logs if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view participation logs' AND tablename = 'participation_logs') THEN
        DROP POLICY "Anyone can view participation logs" ON public.participation_logs;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage participation logs' AND tablename = 'participation_logs') THEN
        DROP POLICY "Admins can manage participation logs" ON public.participation_logs;
    END IF;

    -- Explicit RLS for reading participation_logs
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own submissions' AND tablename = 'participation_logs') THEN
        CREATE POLICY "Users can view their own submissions" ON public.participation_logs FOR SELECT USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all submissions' AND tablename = 'participation_logs') THEN
        CREATE POLICY "Admins can view all submissions" ON public.participation_logs FOR SELECT USING (public.leaderboard_has_role(auth.uid(), 'admin'));
    END IF;
END $$;

-- Ensure participation_logs has no direct user writes
REVOKE INSERT, UPDATE, DELETE ON public.participation_logs FROM authenticated, anon, PUBLIC;
GRANT SELECT ON public.participation_logs TO authenticated;

-- 4. Create participation_submission_events for audit safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'participation_submission_events') THEN
        CREATE TABLE public.participation_submission_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            log_id UUID NOT NULL REFERENCES public.participation_logs(id) ON DELETE CASCADE,
            from_status TEXT,
            to_status TEXT NOT NULL,
            actor_user_id UUID NOT NULL REFERENCES auth.users(id),
            actor_role TEXT NOT NULL,
            evidence_url TEXT,
            awarded_points INTEGER,
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        );
    END IF;
END $$;

ALTER TABLE public.participation_submission_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Users can view events for their own submissions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own events' AND tablename = 'participation_submission_events') THEN
        CREATE POLICY "Users can view their own events" ON public.participation_submission_events
        FOR SELECT USING (
            EXISTS (
            SELECT 1 FROM public.participation_logs pl
            JOIN public.profiles p ON p.id = pl.profile_id
            WHERE pl.id = log_id AND p.user_id = auth.uid()
            )
        );
    END IF;

    -- Admins can view all events
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all events' AND tablename = 'participation_submission_events') THEN
        CREATE POLICY "Admins can view all events" ON public.participation_submission_events
        FOR SELECT USING (public.leaderboard_has_role(auth.uid(), 'admin'));
    END IF;
END $$;

-- No direct inserts to events table
REVOKE INSERT, UPDATE, DELETE ON public.participation_submission_events FROM authenticated, anon, PUBLIC;
GRANT SELECT ON public.participation_submission_events TO authenticated;
GRANT ALL ON public.participation_submission_events TO service_role, postgres;

-- 5. Create submit_participation RPC safely
DO $$
DECLARE
    v_conflicts TEXT;
BEGIN
    SELECT string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ')
    INTO v_conflicts
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname IN ('submit_participation', 'review_participation');

    IF v_conflicts IS NOT NULL THEN
        RAISE EXCEPTION 'Collision detected: functions % already exist. Aborting to prevent silent overwrite of existing RPCs or incompatible overloads.', v_conflicts;
    END IF;
END $$;

CREATE FUNCTION public.submit_participation(
  p_competition_id UUID,
  p_evidence_url TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_existing_log public.participation_logs%ROWTYPE;
  v_log_id UUID;
  v_trimmed_url TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate URL
  v_trimmed_url := btrim(p_evidence_url);
  IF v_trimmed_url IS NULL OR v_trimmed_url = '' THEN
    RAISE EXCEPTION 'Evidence URL cannot be empty';
  END IF;
  IF length(v_trimmed_url) > 2000 THEN
    RAISE EXCEPTION 'Evidence URL exceeds maximum allowed length';
  END IF;
  IF NOT v_trimmed_url LIKE 'https://%' THEN
    RAISE EXCEPTION 'Evidence URL must use the https:// scheme';
  END IF;

  -- Resolve profile securely
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Validate stable member linkage
  IF v_profile.link_status IS DISTINCT FROM 'linked_exact' OR v_profile.member_id IS NULL THEN
    RAISE EXCEPTION 'Identity not securely linked';
  END IF;

  -- Check existing submission
  SELECT * INTO v_existing_log FROM public.participation_logs 
  WHERE profile_id = v_profile.id AND competition_id = p_competition_id;

  IF FOUND THEN
    IF v_existing_log.status IN ('pending', 'approved') THEN
      RAISE EXCEPTION 'Submission is already pending or approved';
    END IF;

    -- Handle resubmission from rejected
    UPDATE public.participation_logs
    SET status = 'pending',
        evidence_url = v_trimmed_url,
        awarded_points = NULL,
        admin_id = NULL,
        verified_at = NULL,
        notes = NULL
    WHERE id = v_existing_log.id
    RETURNING id INTO v_log_id;

    -- Audit event for resubmission
    INSERT INTO public.participation_submission_events 
      (log_id, from_status, to_status, actor_user_id, actor_role, evidence_url)
    VALUES
      (v_log_id, 'rejected', 'pending', v_user_id, 'user', v_trimmed_url);

    RETURN jsonb_build_object('success', true, 'log_id', v_log_id, 'action', 'resubmitted');
  ELSE
    -- Initial submission
    INSERT INTO public.participation_logs 
      (profile_id, competition_id, evidence_url, status)
    VALUES
      (v_profile.id, p_competition_id, v_trimmed_url, 'pending')
    RETURNING id INTO v_log_id;

    -- Audit event for initial submission
    INSERT INTO public.participation_submission_events 
      (log_id, from_status, to_status, actor_user_id, actor_role, evidence_url)
    VALUES
      (v_log_id, NULL, 'pending', v_user_id, 'user', v_trimmed_url);

    RETURN jsonb_build_object('success', true, 'log_id', v_log_id, 'action', 'submitted');
  END IF;
END;
$$;

-- 6. Create review_participation RPC
CREATE FUNCTION public.review_participation(
  p_log_id UUID,
  p_status TEXT,
  p_points INTEGER,
  p_notes TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_existing_log public.participation_logs%ROWTYPE;
BEGIN
  IF v_admin_id IS NULL OR NOT public.leaderboard_has_role(v_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid review status';
  END IF;

  -- Validate approval rules
  IF p_status = 'approved' AND (p_points IS NULL OR p_points < 0) THEN
    RAISE EXCEPTION 'Approved submissions must have non-negative awarded points';
  END IF;
  IF p_status = 'rejected' AND p_points IS NOT NULL THEN
    RAISE EXCEPTION 'Rejected submissions cannot have awarded points';
  END IF;

  SELECT * INTO v_existing_log FROM public.participation_logs WHERE id = p_log_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  -- Idempotent repeated review handler
  IF v_existing_log.status = p_status THEN
    IF v_existing_log.awarded_points IS NOT DISTINCT FROM p_points AND 
       v_existing_log.notes IS NOT DISTINCT FROM p_notes THEN
      RETURN jsonb_build_object('success', true, 'log_id', p_log_id, 'action', 'idempotent');
    ELSE
      RAISE EXCEPTION 'Submission is already %, cannot change review parameters without resubmission', p_status;
    END IF;
  END IF;

  -- Only allow transitions from pending
  IF v_existing_log.status != 'pending' THEN
    RAISE EXCEPTION 'Only pending submissions can be reviewed. Approved submissions are immutable, and rejected submissions must be resubmitted by the user.';
  END IF;

  -- Apply review
  UPDATE public.participation_logs
  SET status = p_status,
      awarded_points = CASE WHEN p_status = 'approved' THEN p_points ELSE NULL END,
      notes = p_notes,
      admin_id = v_admin_id,
      verified_at = now()
  WHERE id = p_log_id;

  -- Audit event for review
  INSERT INTO public.participation_submission_events 
    (log_id, from_status, to_status, actor_user_id, actor_role, evidence_url, awarded_points, notes)
  VALUES
    (p_log_id, 'pending', p_status, v_admin_id, 'admin', v_existing_log.evidence_url, p_points, p_notes);

  RETURN jsonb_build_object('success', true, 'log_id', p_log_id, 'action', p_status);
END;
$$;

-- Grant execution to authenticated users only using exact signatures
GRANT EXECUTE ON FUNCTION public.submit_participation(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_participation(UUID, TEXT, INTEGER, TEXT) TO authenticated;

-- Revoke from public/anon explicitly
REVOKE EXECUTE ON FUNCTION public.submit_participation(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.review_participation(UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon;

COMMIT;
