-- Stage 1A: Fix Privileges and RLS Policies

-- 1. Grant least-privilege table permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- Profiles: Public read, Authenticated update (via RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- User Roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT ON public.user_roles TO anon;

-- Competitions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitions TO authenticated;
GRANT SELECT ON public.competitions TO anon;

-- Participation Logs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.participation_logs TO authenticated;
GRANT SELECT ON public.participation_logs TO anon;

-- Verification Requests
GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_requests TO authenticated;
GRANT SELECT ON public.verification_requests TO anon;

-- 2. Implement Trigger for Profile Creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Member')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Fix missing RLS Policies

-- verification_requests INSERT policy (Members can submit)
CREATE POLICY "Users can create their own requests" 
ON public.verification_requests FOR INSERT 
TO authenticated 
WITH CHECK (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- Users can only edit their own pending requests, and must leave them pending.
CREATE POLICY "Users can edit their own pending requests" 
ON public.verification_requests FOR UPDATE 
TO authenticated 
USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND status = 'pending'
)
WITH CHECK (
    status = 'pending' 
);
