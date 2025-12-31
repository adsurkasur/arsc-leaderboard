-- Add participation_date column to verification_requests
ALTER TABLE public.verification_requests
ADD COLUMN participation_date TIMESTAMPTZ;

-- Add participation_date column to participation_logs
ALTER TABLE public.participation_logs
ADD COLUMN participation_date TIMESTAMPTZ;

-- Comment for documentation
COMMENT ON COLUMN public.verification_requests.participation_date IS 'The date when the user actually participated in the competition';
COMMENT ON COLUMN public.participation_logs.participation_date IS 'The date when the user actually participated in the competition';
