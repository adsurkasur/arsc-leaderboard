-- ==============================================================================
-- Stage 3 Remote Bootstrap Schema (Hardened)
-- Execute via Supabase Dashboard SQL Editor AFTER preflight_stage3.sql.
-- MUST RUN INSIDE AN EXPLICIT TRANSACTION.
-- ==============================================================================

BEGIN;

-- 1. Exact Compatibility Check via Temporary Validation Schema
DO $$
DECLARE
    v_table TEXT;
    v_func TEXT;
    v_pub_hash TEXT;
    v_tmp_hash TEXT;
    v_exists BOOLEAN;
    v_schema_created BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '--- INITIATING EXACT COMPATIBILITY CHECKS ---';

    -- Create an isolated schema to safely instantiate the target state for comparison
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = '_stage3_validation') THEN
        RAISE EXCEPTION 'Validation schema _stage3_validation already exists. Aborting to prevent collision.';
    END IF;

    CREATE SCHEMA _stage3_validation;
    v_schema_created := TRUE;
    SET search_path TO _stage3_validation, pg_temp;

    -- A. Define exact expected types
    CREATE TYPE _stage3_validation.app_role AS ENUM ('admin', 'user');

    -- B. Define exact expected tables
    CREATE TABLE _stage3_validation.members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        canonical_name TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );

    CREATE TABLE _stage3_validation.member_release_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        member_id UUID NOT NULL REFERENCES _stage3_validation.members(id) ON DELETE CASCADE,
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

    CREATE TABLE _stage3_validation.user_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
        role _stage3_validation.app_role NOT NULL DEFAULT 'user',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        UNIQUE (user_id, role)
    );

    CREATE TABLE _stage3_validation.profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
        member_id UUID REFERENCES _stage3_validation.members(id) ON DELETE SET NULL,
        full_name TEXT NOT NULL,
        avatar_url TEXT,
        bidang_biro TEXT,
        link_status TEXT DEFAULT 'unmatched',
        total_participation_count INTEGER NOT NULL DEFAULT 0,
        last_activity_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT valid_bidang_biro CHECK (
            bidang_biro IS NULL OR
            bidang_biro IN (
                'Ketua Umum (KETUM)', 'Biro Pengembangan Sumber Daya Mahasiswa (PSDM)',
                'Biro Administrasi dan Keuangan (ADKEU)', 'Bidang Kepenulisan dan Kompetisi (PENKOM)',
                'Bidang Riset dan Teknologi (RISTEK)', 'Bidang Informasi dan Komunikasi (INFOKOM)'
            )
        ),
        CONSTRAINT check_link_status CHECK (link_status IN ('unmatched', 'linked_exact', 'ambiguous', 'manually_linked'))
    );

    CREATE TABLE _stage3_validation.competitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        date DATE NOT NULL,
        description TEXT,
        category TEXT NOT NULL DEFAULT 'General',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    );

    CREATE TABLE _stage3_validation.participation_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id UUID REFERENCES _stage3_validation.profiles(id) ON DELETE CASCADE NOT NULL,
        competition_id UUID REFERENCES _stage3_validation.competitions(id) ON DELETE CASCADE NOT NULL,
        evidence_url TEXT,
        participation_date TIMESTAMPTZ,
        verified_at TIMESTAMP WITH TIME ZONE,
        admin_id UUID REFERENCES auth.users(id),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        UNIQUE(profile_id, competition_id)
    );

    CREATE TABLE _stage3_validation.verification_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id UUID REFERENCES _stage3_validation.profiles(id) ON DELETE CASCADE NOT NULL,
        competition_id UUID REFERENCES _stage3_validation.competitions(id) ON DELETE CASCADE,
        participation_date TIMESTAMPTZ,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    );

    -- Create helper functions in validation schema to verify signatures
    CREATE FUNCTION _stage3_validation.leaderboard_has_role(_user_id UUID, _role _stage3_validation.app_role)
    RETURNS BOOLEAN
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = ''
    AS $func$
    SELECT EXISTS (
        SELECT 1
        FROM _stage3_validation.user_roles
        WHERE user_roles.user_id = _user_id
        AND user_roles.role = _role
    )
    $func$;

    REVOKE EXECUTE ON FUNCTION _stage3_validation.leaderboard_has_role(UUID, _stage3_validation.app_role) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION _stage3_validation.leaderboard_has_role(UUID, _stage3_validation.app_role) TO authenticated, service_role;

    CREATE FUNCTION _stage3_validation.leaderboard_update_updated_at()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SET search_path = ''
    AS $func$
    BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
    END;
    $func$;

    CREATE FUNCTION _stage3_validation.leaderboard_update_participation_count()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = ''
    AS $func$
    BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE _stage3_validation.profiles 
        SET total_participation_count = total_participation_count + 1,
            last_activity_at = NOW(),
            updated_at = NOW()
        WHERE id = NEW.profile_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE _stage3_validation.profiles 
        SET total_participation_count = GREATEST(0, total_participation_count - 1),
            updated_at = NOW()
        WHERE id = OLD.profile_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
    END;
    $func$;

    -- Attach Triggers
    CREATE TRIGGER leaderboard_profiles_updated_at BEFORE UPDATE ON _stage3_validation.profiles FOR EACH ROW EXECUTE FUNCTION _stage3_validation.leaderboard_update_updated_at();
    CREATE TRIGGER leaderboard_competitions_updated_at BEFORE UPDATE ON _stage3_validation.competitions FOR EACH ROW EXECUTE FUNCTION _stage3_validation.leaderboard_update_updated_at();
    CREATE TRIGGER leaderboard_verification_requests_updated_at BEFORE UPDATE ON _stage3_validation.verification_requests FOR EACH ROW EXECUTE FUNCTION _stage3_validation.leaderboard_update_updated_at();
    CREATE TRIGGER leaderboard_on_participation_log_change AFTER INSERT OR DELETE ON _stage3_validation.participation_logs FOR EACH ROW EXECUTE FUNCTION _stage3_validation.leaderboard_update_participation_count();

    -- Enable RLS
    ALTER TABLE _stage3_validation.members ENABLE ROW LEVEL SECURITY;
    ALTER TABLE _stage3_validation.member_release_links ENABLE ROW LEVEL SECURITY;
    ALTER TABLE _stage3_validation.user_roles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE _stage3_validation.profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE _stage3_validation.competitions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE _stage3_validation.participation_logs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE _stage3_validation.verification_requests ENABLE ROW LEVEL SECURITY;

    -- Set exact expected Grants & Policies
    GRANT ALL ON _stage3_validation.members TO postgres, service_role, supabase_admin;
    GRANT SELECT ON _stage3_validation.members TO authenticated;
    GRANT ALL ON _stage3_validation.member_release_links TO postgres, service_role, supabase_admin;
    GRANT SELECT ON _stage3_validation.member_release_links TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON _stage3_validation.user_roles TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON _stage3_validation.profiles TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON _stage3_validation.competitions TO authenticated;
    GRANT SELECT ON _stage3_validation.competitions TO anon;
    GRANT SELECT ON _stage3_validation.participation_logs TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON _stage3_validation.verification_requests TO authenticated;

    CREATE POLICY "Authenticated users can view members" ON _stage3_validation.members FOR SELECT USING (true);
    CREATE POLICY "Admins can manage members" ON _stage3_validation.members FOR ALL USING (true);
    CREATE POLICY "Authenticated users can view member release links" ON _stage3_validation.member_release_links FOR SELECT USING (true);
    CREATE POLICY "Admins can manage member release links" ON _stage3_validation.member_release_links FOR ALL USING (true);
    CREATE POLICY "Users can view their own roles" ON _stage3_validation.user_roles FOR SELECT USING (true);
    CREATE POLICY "Admins can manage all roles" ON _stage3_validation.user_roles FOR ALL USING (true);
    CREATE POLICY "Users can view own profile" ON _stage3_validation.profiles FOR SELECT USING (true);
    CREATE POLICY "Users can update their own profile" ON _stage3_validation.profiles FOR UPDATE USING (true);
    CREATE POLICY "Admins can manage all profiles" ON _stage3_validation.profiles FOR ALL USING (true);
    CREATE POLICY "Anyone can view competitions" ON _stage3_validation.competitions FOR SELECT USING (true);
    CREATE POLICY "Admins can manage competitions" ON _stage3_validation.competitions FOR ALL USING (true);
    CREATE POLICY "Users can view their own submissions" ON _stage3_validation.participation_logs FOR SELECT USING (true);
    CREATE POLICY "Admins can view all submissions" ON _stage3_validation.participation_logs FOR SELECT USING (true);
    CREATE POLICY "Users can view their own requests" ON _stage3_validation.verification_requests FOR SELECT USING (true);
    CREATE POLICY "Admins can view all requests" ON _stage3_validation.verification_requests FOR SELECT USING (true);
    CREATE POLICY "Admins can manage all requests" ON _stage3_validation.verification_requests FOR ALL USING (true);

    -- C. Cross-Verify Schema Properties
    FOR v_table IN 
        SELECT unnest(ARRAY['members', 'member_release_links', 'user_roles', 'profiles', 'competitions', 'participation_logs', 'verification_requests'])
    LOOP
        SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_table) INTO v_exists;
        IF v_exists THEN
            -- Columns & Defaults
            SELECT md5(string_agg(column_name || ':' || data_type || ':' || COALESCE(is_nullable, '') || ':' || COALESCE(column_default, ''), ',' ORDER BY column_name))
            INTO v_pub_hash FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table;
            SELECT md5(string_agg(column_name || ':' || REPLACE(data_type, '_stage3_validation.', 'public.') || ':' || COALESCE(is_nullable, '') || ':' || COALESCE(REPLACE(column_default, '_stage3_validation.', 'public.'), ''), ',' ORDER BY column_name))
            INTO v_tmp_hash FROM information_schema.columns WHERE table_schema = '_stage3_validation' AND table_name = v_table;
            IF v_pub_hash IS DISTINCT FROM v_tmp_hash THEN RAISE EXCEPTION 'Table % columns/defaults mismatch. Expected % got %', v_table, v_tmp_hash, v_pub_hash; END IF;

            -- Constraints
            SELECT md5(string_agg(contype::text || ':' || pg_get_constraintdef(c.oid), ',' ORDER BY contype, conname)) INTO v_pub_hash FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_namespace n ON t.relnamespace = n.oid WHERE n.nspname = 'public' AND t.relname = v_table;
            SELECT md5(string_agg(contype::text || ':' || REPLACE(pg_get_constraintdef(c.oid), '_stage3_validation.', 'public.'), ',' ORDER BY contype, conname)) INTO v_tmp_hash FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_namespace n ON t.relnamespace = n.oid WHERE n.nspname = '_stage3_validation' AND t.relname = v_table;
            IF v_pub_hash IS DISTINCT FROM v_tmp_hash THEN RAISE EXCEPTION 'Table % constraints structural mismatch.', v_table; END IF;

            -- RLS
            SELECT relrowsecurity::text INTO v_pub_hash FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = 'public' AND c.relname = v_table;
            SELECT relrowsecurity::text INTO v_tmp_hash FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = '_stage3_validation' AND c.relname = v_table;
            IF v_pub_hash IS DISTINCT FROM v_tmp_hash THEN RAISE EXCEPTION 'Table % RLS mismatch.', v_table; END IF;

            -- Policies structure (name + cmd + roles + qual + with_check)
            SELECT md5(string_agg(policyname || ':' || cmd || ':' || roles::text || ':' || COALESCE(qual, '') || ':' || COALESCE(with_check, ''), ',' ORDER BY policyname))
            INTO v_pub_hash FROM pg_policies WHERE schemaname = 'public' AND tablename = v_table;
            SELECT md5(string_agg(policyname || ':' || cmd || ':' || roles::text || ':' || REPLACE(COALESCE(qual, ''), '_stage3_validation.', 'public.') || ':' || REPLACE(COALESCE(with_check, ''), '_stage3_validation.', 'public.'), ',' ORDER BY policyname))
            INTO v_tmp_hash FROM pg_policies WHERE schemaname = '_stage3_validation' AND tablename = v_table;
            IF v_pub_hash IS DISTINCT FROM v_tmp_hash THEN RAISE EXCEPTION 'Table % policies mismatch.', v_table; END IF;

            -- Triggers
            SELECT md5(string_agg(tgname || ':' || pg_get_triggerdef(t.oid), ',' ORDER BY tgname)) INTO v_pub_hash FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = 'public' AND c.relname = v_table AND NOT tgisinternal;
            SELECT md5(string_agg(tgname || ':' || REPLACE(pg_get_triggerdef(t.oid), '_stage3_validation.', 'public.'), ',' ORDER BY tgname)) INTO v_tmp_hash FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = '_stage3_validation' AND c.relname = v_table AND NOT tgisinternal;
            IF v_pub_hash IS DISTINCT FROM v_tmp_hash THEN RAISE EXCEPTION 'Table % triggers mismatch.', v_table; END IF;
            
            -- Grants
            SELECT md5(string_agg(grantee || ':' || privilege_type, ',' ORDER BY grantee, privilege_type)) INTO v_pub_hash FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = v_table AND grantee != 'postgres' AND grantee != 'supabase_admin';
            SELECT md5(string_agg(grantee || ':' || privilege_type, ',' ORDER BY grantee, privilege_type)) INTO v_tmp_hash FROM information_schema.role_table_grants WHERE table_schema = '_stage3_validation' AND table_name = v_table AND grantee != 'postgres' AND grantee != 'supabase_admin';
            IF v_pub_hash IS DISTINCT FROM v_tmp_hash THEN RAISE EXCEPTION 'Table % grants mismatch.', v_table; END IF;

            -- Sequence Grants
            SELECT md5(string_agg(rug.grantee || ':' || rug.privilege_type, ',' ORDER BY rug.grantee, rug.privilege_type))
            INTO v_pub_hash
            FROM pg_class seq 
            JOIN pg_depend d ON d.objid = seq.oid 
            JOIN pg_class t ON d.refobjid = t.oid 
            JOIN pg_namespace n ON t.relnamespace = n.oid 
            JOIN information_schema.role_usage_grants rug ON rug.object_name = seq.relname AND rug.object_schema = n.nspname
            WHERE n.nspname = 'public' AND t.relname = v_table AND seq.relkind = 'S' AND rug.grantee NOT IN ('postgres', 'supabase_admin');

            SELECT md5(string_agg(rug.grantee || ':' || rug.privilege_type, ',' ORDER BY rug.grantee, rug.privilege_type))
            INTO v_tmp_hash
            FROM pg_class seq 
            JOIN pg_depend d ON d.objid = seq.oid 
            JOIN pg_class t ON d.refobjid = t.oid 
            JOIN pg_namespace n ON t.relnamespace = n.oid 
            JOIN information_schema.role_usage_grants rug ON rug.object_name = seq.relname AND rug.object_schema = n.nspname
            WHERE n.nspname = '_stage3_validation' AND t.relname = v_table AND seq.relkind = 'S' AND rug.grantee NOT IN ('postgres', 'supabase_admin');

            IF v_pub_hash IS DISTINCT FROM v_tmp_hash THEN RAISE EXCEPTION 'Table % sequence grants mismatch.', v_table; END IF;
        ELSE
            RAISE NOTICE 'Table %: absent and safe to create.', v_table;
        END IF;
    END LOOP;

    -- Functions
    FOR v_func IN 
        SELECT unnest(ARRAY['leaderboard_has_role', 'leaderboard_update_updated_at', 'leaderboard_update_participation_count'])
    LOOP
        SELECT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = v_func) INTO v_exists;
        IF v_exists THEN
            -- Full definition & properties
            SELECT md5(string_agg(
                pg_get_function_identity_arguments(p.oid) || ':' || 
                pg_get_function_result(p.oid) || ':' ||
                p.prosecdef::text || ':' ||
                p.provolatile || ':' ||
                r.rolname || ':' ||
                COALESCE(array_to_string(p.proconfig, ','), '') || ':' ||
                pg_get_functiondef(p.oid)
                , ',' ORDER BY p.proname)) 
            INTO v_pub_hash 
            FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid JOIN pg_roles r ON p.proowner = r.oid
            WHERE n.nspname = 'public' AND p.proname = v_func;

            SELECT md5(string_agg(
                REPLACE(pg_get_function_identity_arguments(p.oid), '_stage3_validation.', 'public.') || ':' || 
                REPLACE(pg_get_function_result(p.oid), '_stage3_validation.', 'public.') || ':' ||
                p.prosecdef::text || ':' ||
                p.provolatile || ':' ||
                r.rolname || ':' ||
                COALESCE(array_to_string(p.proconfig, ','), '') || ':' ||
                REPLACE(pg_get_functiondef(p.oid), '_stage3_validation.', 'public.')
                , ',' ORDER BY p.proname)) 
            INTO v_tmp_hash 
            FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid JOIN pg_roles r ON p.proowner = r.oid
            WHERE n.nspname = '_stage3_validation' AND p.proname = v_func;

            IF v_pub_hash IS DISTINCT FROM v_tmp_hash THEN RAISE EXCEPTION 'Function % definition/properties mismatch.', v_func; END IF;

            -- Owner & Execute Privileges
            SELECT md5(string_agg(COALESCE(r.rolname, 'PUBLIC') || ':' || a.privilege_type, ',' ORDER BY COALESCE(r.rolname, 'PUBLIC'), a.privilege_type))
            INTO v_pub_hash
            FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
            LEFT JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a ON true
            LEFT JOIN pg_roles r ON a.grantee = r.oid
            WHERE n.nspname = 'public' AND p.proname = v_func;

            SELECT md5(string_agg(COALESCE(r.rolname, 'PUBLIC') || ':' || a.privilege_type, ',' ORDER BY COALESCE(r.rolname, 'PUBLIC'), a.privilege_type))
            INTO v_tmp_hash
            FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
            LEFT JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a ON true
            LEFT JOIN pg_roles r ON a.grantee = r.oid
            WHERE n.nspname = '_stage3_validation' AND p.proname = v_func;

            IF v_pub_hash IS DISTINCT FROM v_tmp_hash THEN RAISE EXCEPTION 'Function % privileges mismatch.', v_func; END IF;
        ELSE
            RAISE NOTICE 'Function %: absent and safe to create.', v_func;
        END IF;
    END LOOP;

    -- Clean up validation schema
    SET search_path TO public;
    IF v_schema_created THEN
        DROP SCHEMA _stage3_validation CASCADE;
    END IF;

    RAISE NOTICE '--- COMPATIBILITY VALIDATION PASSED ---';
EXCEPTION
    WHEN OTHERS THEN
        SET search_path TO public;
        IF v_schema_created THEN
            DROP SCHEMA IF EXISTS _stage3_validation CASCADE;
        END IF;
        RAISE;
END $$;

-- 2. Creation Logic (Executed only if absent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'user');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.member_release_links (
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

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  bidang_biro TEXT,
  link_status TEXT DEFAULT 'unmatched',
  total_participation_count INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Profiles constraints
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_bidang_biro' AND conrelid = 'public.profiles'::regclass) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT valid_bidang_biro CHECK (
            bidang_biro IS NULL OR
            bidang_biro IN (
            'Ketua Umum (KETUM)',
            'Biro Pengembangan Sumber Daya Mahasiswa (PSDM)',
            'Biro Administrasi dan Keuangan (ADKEU)',
            'Bidang Kepenulisan dan Kompetisi (PENKOM)',
            'Bidang Riset dan Teknologi (RISTEK)',
            'Bidang Informasi dan Komunikasi (INFOKOM)'
            )
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_link_status' AND conrelid = 'public.profiles'::regclass) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT check_link_status CHECK (link_status IN ('unmatched', 'linked_exact', 'ambiguous', 'manually_linked'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.participation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  competition_id UUID REFERENCES public.competitions(id) ON DELETE CASCADE NOT NULL,
  evidence_url TEXT,
  participation_date TIMESTAMPTZ,
  verified_at TIMESTAMP WITH TIME ZONE,
  admin_id UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(profile_id, competition_id)
);

CREATE TABLE IF NOT EXISTS public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  competition_id UUID REFERENCES public.competitions(id) ON DELETE CASCADE,
  participation_date TIMESTAMPTZ,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Enable RLS Safely
DO $$
BEGIN
    EXECUTE 'ALTER TABLE public.members ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.member_release_links ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.participation_logs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY';
END $$;

-- 4. Define leaderboard_has_role securely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'leaderboard_has_role'
    ) THEN
        CREATE FUNCTION public.leaderboard_has_role(_user_id UUID, _role public.app_role)
        RETURNS BOOLEAN
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = ''
        AS $func$
        SELECT EXISTS (
            SELECT 1
            FROM public.user_roles
            WHERE user_roles.user_id = _user_id
            AND user_roles.role = _role
        )
        $func$;
        
        REVOKE EXECUTE ON FUNCTION public.leaderboard_has_role(UUID, public.app_role) FROM PUBLIC, anon;
        GRANT EXECUTE ON FUNCTION public.leaderboard_has_role(UUID, public.app_role) TO authenticated, service_role;
    END IF;
END $$;

-- 5. Define Triggers securely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'leaderboard_update_updated_at'
    ) THEN
        CREATE FUNCTION public.leaderboard_update_updated_at()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        SET search_path = ''
        AS $func$
        BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
        END;
        $func$;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'leaderboard_update_participation_count'
    ) THEN
        CREATE FUNCTION public.leaderboard_update_participation_count()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = ''
        AS $func$
        BEGIN
        IF TG_OP = 'INSERT' THEN
            UPDATE public.profiles 
            SET total_participation_count = total_participation_count + 1,
                last_activity_at = NOW(),
                updated_at = NOW()
            WHERE id = NEW.profile_id;
            RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE public.profiles 
            SET total_participation_count = GREATEST(0, total_participation_count - 1),
                updated_at = NOW()
            WHERE id = OLD.profile_id;
            RETURN OLD;
        END IF;
        RETURN NULL;
        END;
        $func$;
    END IF;
END $$;

-- Attach Triggers (Only if absent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'leaderboard_profiles_updated_at') THEN
        CREATE TRIGGER leaderboard_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.leaderboard_update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'leaderboard_competitions_updated_at') THEN
        CREATE TRIGGER leaderboard_competitions_updated_at BEFORE UPDATE ON public.competitions FOR EACH ROW EXECUTE FUNCTION public.leaderboard_update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'leaderboard_verification_requests_updated_at') THEN
        CREATE TRIGGER leaderboard_verification_requests_updated_at BEFORE UPDATE ON public.verification_requests FOR EACH ROW EXECUTE FUNCTION public.leaderboard_update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'leaderboard_on_participation_log_change') THEN
        CREATE TRIGGER leaderboard_on_participation_log_change AFTER INSERT OR DELETE ON public.participation_logs FOR EACH ROW EXECUTE FUNCTION public.leaderboard_update_participation_count();
    END IF;
END $$;

-- 6. Set explicit Grants and Policies (Additive only)
DO $$
BEGIN
    GRANT ALL ON public.members TO postgres, service_role, supabase_admin;
    GRANT SELECT ON public.members TO authenticated;
    GRANT ALL ON public.member_release_links TO postgres, service_role, supabase_admin;
    GRANT SELECT ON public.member_release_links TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitions TO authenticated;
    GRANT SELECT ON public.competitions TO anon;
    GRANT SELECT ON public.participation_logs TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_requests TO authenticated;

    -- Members & Links Policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view members' AND tablename = 'members') THEN
        CREATE POLICY "Authenticated users can view members" ON public.members FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage members' AND tablename = 'members') THEN
        CREATE POLICY "Admins can manage members" ON public.members FOR ALL USING (public.leaderboard_has_role(auth.uid(), 'admin'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view member release links' AND tablename = 'member_release_links') THEN
        CREATE POLICY "Authenticated users can view member release links" ON public.member_release_links FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage member release links' AND tablename = 'member_release_links') THEN
        CREATE POLICY "Admins can manage member release links" ON public.member_release_links FOR ALL USING (public.leaderboard_has_role(auth.uid(), 'admin'));
    END IF;

    -- User Roles Policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own roles' AND tablename = 'user_roles') THEN
        CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage all roles' AND tablename = 'user_roles') THEN
        CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (public.leaderboard_has_role(auth.uid(), 'admin'));
    END IF;

    -- Profiles Policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own profile' AND tablename = 'profiles') THEN
        CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own profile' AND tablename = 'profiles') THEN
        CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage all profiles' AND tablename = 'profiles') THEN
        CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (public.leaderboard_has_role(auth.uid(), 'admin'));
    END IF;

    -- Competitions Policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view competitions' AND tablename = 'competitions') THEN
        CREATE POLICY "Anyone can view competitions" ON public.competitions FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage competitions' AND tablename = 'competitions') THEN
        CREATE POLICY "Admins can manage competitions" ON public.competitions FOR ALL USING (public.leaderboard_has_role(auth.uid(), 'admin'));
    END IF;

    -- Participation Logs (Read-only via REST, writes controlled by RPCs)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own submissions' AND tablename = 'participation_logs') THEN
        CREATE POLICY "Users can view their own submissions" ON public.participation_logs FOR SELECT USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all submissions' AND tablename = 'participation_logs') THEN
        CREATE POLICY "Admins can view all submissions" ON public.participation_logs FOR SELECT USING (public.leaderboard_has_role(auth.uid(), 'admin'));
    END IF;

    -- Verification Requests Policies (Read-only via REST)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own requests' AND tablename = 'verification_requests') THEN
        CREATE POLICY "Users can view their own requests" ON public.verification_requests FOR SELECT USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all requests' AND tablename = 'verification_requests') THEN
        CREATE POLICY "Admins can view all requests" ON public.verification_requests FOR SELECT USING (public.leaderboard_has_role(auth.uid(), 'admin'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage all requests' AND tablename = 'verification_requests') THEN
        CREATE POLICY "Admins can manage all requests" ON public.verification_requests FOR ALL USING (public.leaderboard_has_role(auth.uid(), 'admin'));
    END IF;
END $$;

COMMIT;
