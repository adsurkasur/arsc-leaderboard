-- Stage 1B: Rapor-Compatible Foundations

-- 1. Identity Model Additions
-- Add member_id (stable opaque) distinct from profile_id and auth_user_id
ALTER TABLE public.profiles 
ADD COLUMN member_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
ADD COLUMN release_member_code TEXT UNIQUE;

-- 2. Submission & Evidence Additions
ALTER TABLE public.verification_requests 
ADD COLUMN achievement TEXT,
ADD COLUMN evidence_url TEXT;

-- 3. Participation Log Additions
-- We add the Rapor-compatible fields to the final log.
ALTER TABLE public.participation_logs 
ADD COLUMN achievement TEXT,
ADD COLUMN evidence_url TEXT;

-- 4. Audit & Review Fields
-- participation_logs already has admin_id, verified_at, and notes from original schema.
-- Let's ensure verification_requests also tracks who reviewed it, and when.
ALTER TABLE public.verification_requests 
ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN reviewer_id UUID REFERENCES auth.users(id),
ADD COLUMN reviewer_notes TEXT;

-- 5. Data Integrity Constraints
-- Ensure achievement is not empty if provided
ALTER TABLE public.verification_requests 
ADD CONSTRAINT check_achievement_not_empty CHECK (achievement IS NULL OR length(trim(achievement)) > 0);

ALTER TABLE public.participation_logs 
ADD CONSTRAINT check_log_achievement_not_empty CHECK (achievement IS NULL OR length(trim(achievement)) > 0);

-- Trigger to auto-set reviewed_at when status changes from pending
CREATE OR REPLACE FUNCTION public.handle_verification_review()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    NEW.reviewed_at = NOW();
    -- NEW.reviewer_id should be set by the admin performing the update
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_verification_review
  BEFORE UPDATE ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_verification_review();
