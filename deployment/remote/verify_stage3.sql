-- ==============================================================================
-- Stage 3 Remote Verification Script
-- Execute manually via Supabase Dashboard SQL Editor AFTER stage3_restricted_write.sql
-- ==============================================================================

BEGIN;

CREATE TEMPORARY TABLE verify_results (
    category TEXT,
    object_name TEXT,
    check_name TEXT,
    hash_value TEXT
) ON COMMIT DROP;

DO $$
DECLARE
    v_rec RECORD;
    v_fnc RECORD;
    v_count TEXT;
    v_def TEXT;
    v_hash TEXT;
    v_args TEXT;
    v_ret TEXT;
    v_secdef BOOLEAN;
    v_vol TEXT;
    v_owner TEXT;
    v_config TEXT;
BEGIN
    INSERT INTO verify_results VALUES ('--- SHARED / OWNERSHIP UNRESOLVED / PROTECTED TABLES ---', 'Compare against preflight output', '', '');
    
    FOR v_rec IN 
        SELECT c.oid, c.relname as table_name, c.relrowsecurity 
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' 
          AND c.relkind = 'r'
          AND c.relname IN (
              'admin_profiles', 'appointments', 'chat_messages', 'chat_sessions',
              'key_log', 'key_status', 'notifications', 'report_status_history',
              'reports', 'users',
              'rapor_access_codes', 'rapor_members', 'rapor_payloads',
              'rapor_releases', 'rapor_sync_runs'
          )
        ORDER BY c.relname
    LOOP
        -- Columns & Defaults
        SELECT md5(string_agg(column_name || ':' || data_type || ':' || COALESCE(is_nullable, '') || ':' || COALESCE(column_default, ''), ',' ORDER BY ordinal_position))
        INTO v_hash FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_rec.table_name;
        INSERT INTO verify_results VALUES ('TABLE', v_rec.table_name, 'Columns Hash', COALESCE(v_hash, 'none'));

        -- Constraints (PK, FK, Unique, Check)
        SELECT md5(string_agg(conname || ':' || contype::text || ':' || pg_get_constraintdef(oid), ',' ORDER BY conname))
        INTO v_hash FROM pg_constraint WHERE conrelid = v_rec.oid;
        INSERT INTO verify_results VALUES ('TABLE', v_rec.table_name, 'Constraints Hash', COALESCE(v_hash, 'none'));

        -- RLS Enabled State
        INSERT INTO verify_results VALUES ('TABLE', v_rec.table_name, 'RLS Enabled', v_rec.relrowsecurity::text);

        -- Policies
        SELECT md5(string_agg(policyname || ':' || cmd || ':' || roles::text || ':' || COALESCE(qual::text, '') || ':' || COALESCE(with_check::text, ''), ',' ORDER BY policyname))
        INTO v_hash FROM pg_policies WHERE schemaname = 'public' AND tablename = v_rec.table_name;
        INSERT INTO verify_results VALUES ('TABLE', v_rec.table_name, 'Policies Hash', COALESCE(v_hash, 'none'));

        -- Table Grants
        SELECT md5(string_agg(grantee || ':' || privilege_type, ',' ORDER BY grantee, privilege_type))
        INTO v_hash FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = v_rec.table_name;
        INSERT INTO verify_results VALUES ('TABLE', v_rec.table_name, 'Table Grants Hash', COALESCE(v_hash, 'none'));

        -- Sequence Grants
        SELECT md5(string_agg(c.relname || ':' || array_to_string(c.relacl, ','), ',' ORDER BY c.relname))
        INTO v_hash FROM pg_class c JOIN pg_depend d ON c.oid = d.objid WHERE d.refobjid = v_rec.oid AND c.relkind = 'S';
        INSERT INTO verify_results VALUES ('TABLE', v_rec.table_name, 'Sequence Grants Hash', COALESCE(v_hash, 'none'));

        -- Triggers & Complete Definitions
        SELECT md5(string_agg(tgname || ':' || pg_get_triggerdef(oid), ',' ORDER BY tgname))
        INTO v_hash FROM pg_trigger WHERE tgrelid = v_rec.oid AND NOT tgisinternal;
        INSERT INTO verify_results VALUES ('TABLE', v_rec.table_name, 'Triggers Hash', COALESCE(v_hash, 'none'));
    END LOOP;

    INSERT INTO verify_results VALUES ('--- SHARED / OWNERSHIP UNRESOLVED / PROTECTED FUNCTIONS ---', 'Compare against preflight output', '', '');
    
    FOR v_fnc IN 
        SELECT p.oid, p.proname, p.proacl
        FROM pg_proc p 
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' 
          AND p.proname IN (
              'get_leaderboard_reference_members',
              'can_insert_admin_profile',
              'current_app_role',
              'handle_auth_user_email_update',
              'handle_new_auth_user',
              'is_admin',
              'sync_admin_profile',
              'sync_reporter_identity_snapshot',
              'sync_whatsapp_to_auth_phone',
              'touch_updated_at',
              'update_updated_at',
              'update_updated_at_column'
          )
        ORDER BY p.proname
    LOOP
        -- Identity Signature & Return Contract
        SELECT pg_get_function_identity_arguments(v_fnc.oid), pg_get_function_result(v_fnc.oid), p.prosecdef, p.provolatile, r.rolname, array_to_string(p.proconfig, ',')
        INTO v_args, v_ret, v_secdef, v_vol, v_owner, v_config
        FROM pg_proc p JOIN pg_roles r ON p.proowner = r.oid WHERE p.oid = v_fnc.oid;

        INSERT INTO verify_results VALUES ('FUNCTION', v_fnc.proname, 'Signature', v_args);
        INSERT INTO verify_results VALUES ('FUNCTION', v_fnc.proname, 'Return Contract', v_ret);
        INSERT INTO verify_results VALUES ('FUNCTION', v_fnc.proname, 'Security Definer', v_secdef::text);
        INSERT INTO verify_results VALUES ('FUNCTION', v_fnc.proname, 'Volatility', v_vol);
        INSERT INTO verify_results VALUES ('FUNCTION', v_fnc.proname, 'Owner', v_owner);
        INSERT INTO verify_results VALUES ('FUNCTION', v_fnc.proname, 'Config/Search Path', COALESCE(v_config, 'none'));

        -- Definition Hash
        v_def := pg_get_functiondef(v_fnc.oid);
        INSERT INTO verify_results VALUES ('FUNCTION', v_fnc.proname, 'Definition Hash', md5(v_def));

        -- Execute Privileges (Identity Specific)
        IF v_fnc.proacl IS NULL THEN
            v_hash := md5('public:' || v_fnc.proname || ':' || v_args || ':DEFAULT_PERMISSIONS');
        ELSE
            SELECT md5(string_agg('public:' || v_fnc.proname || ':' || v_args || ':' || COALESCE(r.rolname, 'PUBLIC') || ':' || a.privilege_type, ',' ORDER BY COALESCE(r.rolname, 'PUBLIC'), a.privilege_type))
            INTO v_hash
            FROM pg_proc p
            LEFT JOIN LATERAL aclexplode(p.proacl) a ON true
            LEFT JOIN pg_roles r ON a.grantee = r.oid
            WHERE p.oid = v_fnc.oid;
        END IF;
        INSERT INTO verify_results VALUES ('FUNCTION', v_fnc.proname, 'Execute Grants Hash', COALESCE(v_hash, 'none'));
    END LOOP;

    INSERT INTO verify_results VALUES ('--- STAGE 3 LEADERBOARD SCHEMA ---', '', '', '');
    FOR v_rec IN 
        SELECT c.relname as table_name, c.relrowsecurity as rls_enabled
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' 
          AND c.relname IN ('members', 'member_release_links', 'user_roles', 'profiles', 'competitions', 'participation_logs', 'verification_requests', 'participation_submission_events')
          AND c.relkind = 'r'
        ORDER BY c.relname
    LOOP
        EXECUTE format('SELECT count(*) FROM public.%I', v_rec.table_name) INTO v_count;
        INSERT INTO verify_results VALUES ('Table Status', v_rec.table_name, 'RLS Enabled: ' || v_rec.rls_enabled::text, 'Rows: ' || v_count);
    END LOOP;

    INSERT INTO verify_results VALUES ('--- SECURITY POLICY ASSERTIONS ---', '', '', '');
    
    -- Ensure anon cannot read profiles/roles
    SELECT EXISTS (
        SELECT 1 FROM information_schema.role_table_grants 
        WHERE grantee = 'anon' AND table_name IN ('profiles', 'user_roles') AND privilege_type = 'SELECT'
    ) INTO v_hash;
    INSERT INTO verify_results VALUES ('Security Check', 'Is anon blocked from profiles & user_roles?', '', (v_hash = 'false')::text);

    -- Ensure restricted direct write to participation_logs & events
    SELECT EXISTS (
        SELECT 1 FROM information_schema.role_table_grants 
        WHERE grantee IN ('authenticated', 'anon', 'PUBLIC') 
        AND table_name IN ('participation_logs', 'participation_submission_events') 
        AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
    ) INTO v_hash;
    INSERT INTO verify_results VALUES ('Security Check', 'Are direct writes blocked for users?', '', (v_hash = 'false')::text);

    -- Ensure write RPCs exist and are authenticated-only
    FOR v_rec IN
        SELECT p.proname 
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname IN ('submit_participation', 'review_participation')
    LOOP
        SELECT string_agg(grantee || ':' || privilege_type, ',') INTO v_def
        FROM information_schema.routine_privileges
        WHERE routine_schema = 'public' AND routine_name = v_rec.proname AND grantee IN ('anon', 'PUBLIC');
        
        INSERT INTO verify_results VALUES ('RPC Permissions', v_rec.proname, 'Anon/Public execute grants', COALESCE(v_def, 'NONE (Secure)'));
    END LOOP;

END $$;

SELECT * FROM verify_results;

ROLLBACK;
