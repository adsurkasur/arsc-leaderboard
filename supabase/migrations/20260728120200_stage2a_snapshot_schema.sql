-- Stage 2A: Rapor Snapshot Schema

-- 1. Create canonical members table
CREATE TABLE public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create release links table
CREATE TABLE public.member_release_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    release_code TEXT NOT NULL,
    release_member_code TEXT NOT NULL,
    unit TEXT,
    position TEXT,
    evaluation_status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (release_code, release_member_code),
    UNIQUE (member_id, release_code)
);

-- Grant privileges for backend functions
GRANT ALL ON public.members TO postgres, service_role, supabase_admin;
GRANT ALL ON public.member_release_links TO postgres, service_role, supabase_admin;

-- 3. Update profiles table
-- Drop the Stage 1B member_id and release_member_code as we now have a dedicated schema.
ALTER TABLE public.profiles
DROP COLUMN release_member_code,
DROP COLUMN member_id;

-- Re-add member_id as a nullable foreign key
ALTER TABLE public.profiles
ADD COLUMN member_id UUID REFERENCES public.members(id) ON DELETE SET NULL;

-- Also add a column to track how it was linked
ALTER TABLE public.profiles
ADD COLUMN link_status TEXT DEFAULT 'unmatched',
ADD CONSTRAINT check_link_status CHECK (link_status IN ('unmatched', 'linked_exact', 'ambiguous', 'manually_linked'));

-- 4. Set up RLS
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_release_links ENABLE ROW LEVEL SECURITY;

-- Admins can do anything. Authenticated users can read.
CREATE POLICY "Authenticated users can view members" 
    ON public.members FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage members" 
    ON public.members FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
        )
    );

CREATE POLICY "Authenticated users can view member release links" 
    ON public.member_release_links FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage member release links" 
    ON public.member_release_links FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
        )
    );
