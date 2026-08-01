-- Stage 3: Restricted Write Architecture

-- 1. Revoke excessive anonymous read access
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.user_roles FROM anon;

-- 2. Harden has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = _user_id
      AND user_roles.role = _role
  )
$$;

-- Secure has_role execution
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;

-- 3. Evolve participation_logs functionally
-- Note: evidence_url was already added in 20260728120100_stage1b_rapor_foundations.sql
ALTER TABLE public.participation_logs
  ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN awarded_points INTEGER;

-- Drop permissive write and read policies on participation_logs
DROP POLICY IF EXISTS "Anyone can view participation logs" ON public.participation_logs;
DROP POLICY IF EXISTS "Admins can manage participation logs" ON public.participation_logs;

-- Explicit RLS for reading participation_logs
CREATE POLICY "Users can view their own submissions" ON public.participation_logs
  FOR SELECT USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all submissions" ON public.participation_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Ensure participation_logs has no direct user writes
REVOKE INSERT, UPDATE, DELETE ON public.participation_logs FROM authenticated, anon;
GRANT SELECT ON public.participation_logs TO authenticated;

-- 4. Create participation_submission_events for audit
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

ALTER TABLE public.participation_submission_events ENABLE ROW LEVEL SECURITY;

-- Users can view events for their own submissions
CREATE POLICY "Users can view their own events" ON public.participation_submission_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.participation_logs pl
      JOIN public.profiles p ON p.id = pl.profile_id
      WHERE pl.id = log_id AND p.user_id = auth.uid()
    )
  );

-- Admins can view all events
CREATE POLICY "Admins can view all events" ON public.participation_submission_events
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- No direct inserts to events table
REVOKE INSERT, UPDATE, DELETE ON public.participation_submission_events FROM authenticated, anon;
GRANT SELECT ON public.participation_submission_events TO authenticated;
GRANT ALL ON public.participation_submission_events TO service_role, postgres;

-- 5. Create submit_participation RPC
CREATE OR REPLACE FUNCTION public.submit_participation(
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Resolve profile securely
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Validate stable member linkage
  IF v_profile.link_status != 'linked_exact' OR v_profile.member_id IS NULL THEN
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
        evidence_url = p_evidence_url,
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
      (v_log_id, 'rejected', 'pending', v_user_id, 'user', p_evidence_url);

    RETURN jsonb_build_object('success', true, 'log_id', v_log_id, 'action', 'resubmitted');
  ELSE
    -- Initial submission
    INSERT INTO public.participation_logs 
      (profile_id, competition_id, evidence_url, status)
    VALUES
      (v_profile.id, p_competition_id, p_evidence_url, 'pending')
    RETURNING id INTO v_log_id;

    -- Audit event for initial submission
    INSERT INTO public.participation_submission_events 
      (log_id, from_status, to_status, actor_user_id, actor_role, evidence_url)
    VALUES
      (v_log_id, NULL, 'pending', v_user_id, 'user', p_evidence_url);

    RETURN jsonb_build_object('success', true, 'log_id', v_log_id, 'action', 'submitted');
  END IF;
END;
$$;

-- 6. Create review_participation RPC
CREATE OR REPLACE FUNCTION public.review_participation(
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
  IF v_admin_id IS NULL OR NOT public.has_role(v_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid review status';
  END IF;

  SELECT * INTO v_existing_log FROM public.participation_logs WHERE id = p_log_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  -- Only allow transitions from pending
  IF v_existing_log.status != 'pending' THEN
    -- Check for idempotency: if repeating the EXACT same review on the same status, return success
    IF v_existing_log.status = p_status AND 
       v_existing_log.awarded_points IS NOT DISTINCT FROM p_points AND 
       v_existing_log.notes IS NOT DISTINCT FROM p_notes THEN
      RETURN jsonb_build_object('success', true, 'log_id', p_log_id, 'action', 'idempotent');
    END IF;
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

-- Grant execution to authenticated users only
GRANT EXECUTE ON FUNCTION public.submit_participation TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_participation TO authenticated;

-- Revoke from public/anon
REVOKE EXECUTE ON FUNCTION public.submit_participation FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.review_participation FROM PUBLIC, anon;
