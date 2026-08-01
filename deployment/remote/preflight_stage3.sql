-- ==============================================================================
-- Stage 3 Remote Preflight
-- Strictly Read-Only Fingerprinting & Validation
-- Execute manually in the Supabase Dashboard SQL Editor.
-- DO NOT RUN OUTSIDE AN EXPLICIT TRANSACTION.
-- ==============================================================================

BEGIN;

CREATE TEMPORARY TABLE preflight_results (
    category TEXT,
    object_name TEXT,
    check_name TEXT,
    hash_value TEXT
) ON COMMIT DROP;

DO $$
DECLARE
    v_rec RECORD;
    v_fnc RECORD;
    v_def TEXT;
    v_hash TEXT;
    v_args TEXT;
    v_ret TEXT;
    v_secdef BOOLEAN;
    v_vol TEXT;
    v_owner TEXT;
    v_config TEXT;
BEGIN
    INSERT INTO preflight_results VALUES ('--- SHARED / OWNERSHIP UNRESOLVED / PROTECTED TABLES ---', '', '', '');
    
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
        INSERT INTO preflight_results VALUES ('TABLE', v_rec.table_name, 'Columns Hash', COALESCE(v_hash, 'none'));

        -- Constraints (PK, FK, Unique, Check)
        SELECT md5(string_agg(conname || ':' || contype::text || ':' || pg_get_constraintdef(oid), ',' ORDER BY conname))
        INTO v_hash FROM pg_constraint WHERE conrelid = v_rec.oid;
        INSERT INTO preflight_results VALUES ('TABLE', v_rec.table_name, 'Constraints Hash', COALESCE(v_hash, 'none'));

        -- RLS Enabled State
        INSERT INTO preflight_results VALUES ('TABLE', v_rec.table_name, 'RLS Enabled', v_rec.relrowsecurity::text);

        -- Policies
        SELECT md5(string_agg(policyname || ':' || cmd || ':' || roles::text || ':' || COALESCE(qual::text, '') || ':' || COALESCE(with_check::text, ''), ',' ORDER BY policyname))
        INTO v_hash FROM pg_policies WHERE schemaname = 'public' AND tablename = v_rec.table_name;
        INSERT INTO preflight_results VALUES ('TABLE', v_rec.table_name, 'Policies Hash', COALESCE(v_hash, 'none'));

        -- Table Grants
        SELECT md5(string_agg(grantee || ':' || privilege_type, ',' ORDER BY grantee, privilege_type))
        INTO v_hash FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = v_rec.table_name;
        INSERT INTO preflight_results VALUES ('TABLE', v_rec.table_name, 'Table Grants Hash', COALESCE(v_hash, 'none'));

        -- Sequence Grants
        SELECT md5(string_agg(c.relname || ':' || array_to_string(c.relacl, ','), ',' ORDER BY c.relname))
        INTO v_hash FROM pg_class c JOIN pg_depend d ON c.oid = d.objid WHERE d.refobjid = v_rec.oid AND c.relkind = 'S';
        INSERT INTO preflight_results VALUES ('TABLE', v_rec.table_name, 'Sequence Grants Hash', COALESCE(v_hash, 'none'));

        -- Triggers & Complete Definitions
        SELECT md5(string_agg(tgname || ':' || pg_get_triggerdef(oid), ',' ORDER BY tgname))
        INTO v_hash FROM pg_trigger WHERE tgrelid = v_rec.oid AND NOT tgisinternal;
        INSERT INTO preflight_results VALUES ('TABLE', v_rec.table_name, 'Triggers Hash', COALESCE(v_hash, 'none'));
    END LOOP;

    INSERT INTO preflight_results VALUES ('--- SHARED / OWNERSHIP UNRESOLVED / PROTECTED FUNCTIONS ---', '', '', '');
    
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

        INSERT INTO preflight_results VALUES ('FUNCTION', v_fnc.proname, 'Signature', v_args);
        INSERT INTO preflight_results VALUES ('FUNCTION', v_fnc.proname, 'Return Contract', v_ret);
        INSERT INTO preflight_results VALUES ('FUNCTION', v_fnc.proname, 'Security Definer', v_secdef::text);
        INSERT INTO preflight_results VALUES ('FUNCTION', v_fnc.proname, 'Volatility', v_vol);
        INSERT INTO preflight_results VALUES ('FUNCTION', v_fnc.proname, 'Owner', v_owner);
        INSERT INTO preflight_results VALUES ('FUNCTION', v_fnc.proname, 'Config/Search Path', COALESCE(v_config, 'none'));

        -- Definition Hash
        v_def := pg_get_functiondef(v_fnc.oid);
        INSERT INTO preflight_results VALUES ('FUNCTION', v_fnc.proname, 'Definition Hash', md5(v_def));

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
        INSERT INTO preflight_results VALUES ('FUNCTION', v_fnc.proname, 'Execute Grants Hash', COALESCE(v_hash, 'none'));
    END LOOP;

    INSERT INTO preflight_results VALUES ('--- LEADERBOARD NAMESPACE PRE-CHECK ---', '', '', '');
    
    FOR v_rec IN 
        SELECT p.proname 
        FROM pg_proc p 
        JOIN pg_namespace n ON n.oid = p.pronamespace 
        WHERE n.nspname = 'public' AND p.proname IN (
            'leaderboard_has_role', 
            'leaderboard_update_updated_at', 
            'leaderboard_update_participation_count',
            'submit_participation', 
            'review_participation'
        )
    LOOP
        INSERT INTO preflight_results VALUES ('WARNING', v_rec.proname, 'Conflict', 'Already exists remotely');
    END LOOP;

END $$;

SELECT * FROM preflight_results;

ROLLBACK;
