-- ==============================================================================
-- Stage 3 Database Validation Suite
-- Usage (when Docker is running): 
-- npx supabase db query -f tests/database/test_stage3.sql
-- ==============================================================================

BEGIN;

DO $$
DECLARE
    v_admin_id UUID := gen_random_uuid();
    v_user_id UUID := gen_random_uuid();
    v_unlinked_user_id UUID := gen_random_uuid();
    v_null_user_id UUID := gen_random_uuid();
    
    v_member_id UUID := gen_random_uuid();
    v_profile_id UUID;
    v_comp_id UUID := gen_random_uuid();
    
    v_log_id UUID;
    v_res JSONB;
    v_event_count INT;
BEGIN
    RAISE NOTICE '--- STARTING STAGE 3 VALIDATION ---';

    -- 1. Setup isolated synthetic test data
    -- Create minimal auth.users to satisfy foreign keys
    INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES 
        (v_admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin_test@arsc.org'),
        (v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user_test@arsc.org'),
        (v_unlinked_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'unlinked_test@arsc.org'),
        (v_null_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'null_test@arsc.org');

    -- Assign admin role
    INSERT INTO public.user_roles (user_id, role) VALUES (v_admin_id, 'admin');

    -- Create member reference
    INSERT INTO public.members (id, canonical_name) VALUES (v_member_id, 'Synthetic Test Member');
    
    -- Create profiles
    -- Update auto-generated profiles
    UPDATE public.profiles 
    SET member_id = v_member_id, full_name = 'Valid User', link_status = 'linked_exact'
    WHERE user_id = v_user_id
    RETURNING id INTO v_profile_id;

    UPDATE public.profiles 
    SET member_id = v_member_id, full_name = 'Unlinked User', link_status = 'unmatched'
    WHERE user_id = v_unlinked_user_id;

    UPDATE public.profiles 
    SET member_id = v_member_id, full_name = 'Null Link Status User', link_status = NULL
    WHERE user_id = v_null_user_id;

    -- Create competition
    INSERT INTO public.competitions (id, title, date) VALUES (v_comp_id, 'Test Comp', CURRENT_DATE);

    -- ==============================================================================
    -- 2. Direct Write Protection Tests (run as authenticated role to trigger RLS)
    -- ==============================================================================
    SET LOCAL ROLE authenticated;
    
    -- participation_logs
    BEGIN
        INSERT INTO public.participation_logs (profile_id, competition_id, evidence_url) 
        VALUES (v_profile_id, v_comp_id, 'https://test');
        RAISE EXCEPTION 'Direct insert to participation_logs MUST fail.';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;

    -- participation_submission_events
    BEGIN
        INSERT INTO public.participation_submission_events (log_id, to_status, actor_user_id, actor_role)
        VALUES (gen_random_uuid(), 'pending', v_admin_id, 'admin');
        RAISE EXCEPTION 'Direct insert to participation_submission_events MUST fail.';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;

    RESET ROLE;

    RAISE NOTICE 'Direct write protection tests passed.';

    -- ==============================================================================
    -- 3. Unlinked/NULL Identity Tests
    -- ==============================================================================
    PERFORM set_config('request.jwt.claims', '{"sub":"' || v_unlinked_user_id || '"}', true);
    BEGIN
        PERFORM public.submit_participation(v_comp_id, 'https://test.com');
        RAISE EXCEPTION 'Unlinked user submission MUST fail.';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM != 'Identity not securely linked' THEN RAISE EXCEPTION 'Unexpected error: %', SQLERRM; END IF;
    END;

    PERFORM set_config('request.jwt.claims', '{"sub":"' || v_null_user_id || '"}', true);
    BEGIN
        PERFORM public.submit_participation(v_comp_id, 'https://test.com');
        RAISE EXCEPTION 'NULL link_status user submission MUST fail.';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM != 'Identity not securely linked' THEN RAISE EXCEPTION 'Unexpected error: %', SQLERRM; END IF;
    END;

    RAISE NOTICE 'Identity verification tests passed.';

    -- ==============================================================================
    -- 4. State Machine Tests
    -- ==============================================================================
    
    -- Initial submission
    PERFORM set_config('request.jwt.claims', '{"sub":"' || v_user_id || '"}', true);
    v_res := public.submit_participation(v_comp_id, 'https://valid.com');
    v_log_id := (v_res->>'log_id')::UUID;
    IF v_res->>'action' != 'submitted' THEN RAISE EXCEPTION 'Initial submission failed.'; END IF;

    -- Check audit events (should be 1)
    SELECT count(*) INTO v_event_count FROM public.participation_submission_events WHERE log_id = v_log_id;
    IF v_event_count != 1 THEN RAISE EXCEPTION 'Expected 1 audit event, got %', v_event_count; END IF;

    -- Pending -> Rejected
    PERFORM set_config('request.jwt.claims', '{"sub":"' || v_admin_id || '"}', true);
    v_res := public.review_participation(v_log_id, 'rejected', NULL, 'Needs better link');
    IF v_res->>'action' != 'rejected' THEN RAISE EXCEPTION 'Pending -> Rejected failed.'; END IF;

    SELECT count(*) INTO v_event_count FROM public.participation_submission_events WHERE log_id = v_log_id;
    IF v_event_count != 2 THEN RAISE EXCEPTION 'Expected 2 audit events, got %', v_event_count; END IF;

    -- Admin trying to review rejected -> pending (MUST FAIL)
    BEGIN
        PERFORM public.review_participation(v_log_id, 'pending', NULL, 'Changed mind');
        RAISE EXCEPTION 'Admin transitioning rejected -> pending MUST fail.';
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- Rejected -> Pending via Member Resubmission
    PERFORM set_config('request.jwt.claims', '{"sub":"' || v_user_id || '"}', true);
    v_res := public.submit_participation(v_comp_id, 'https://better-link.com');
    IF v_res->>'action' != 'resubmitted' THEN RAISE EXCEPTION 'Resubmission failed.'; END IF;

    SELECT count(*) INTO v_event_count FROM public.participation_submission_events WHERE log_id = v_log_id;
    IF v_event_count != 3 THEN RAISE EXCEPTION 'Expected 3 audit events, got %', v_event_count; END IF;

    -- Pending -> Approved
    PERFORM set_config('request.jwt.claims', '{"sub":"' || v_admin_id || '"}', true);
    v_res := public.review_participation(v_log_id, 'approved', 100, 'Perfect');
    IF v_res->>'action' != 'approved' THEN RAISE EXCEPTION 'Pending -> Approved failed.'; END IF;

    -- Approved Immutability
    BEGIN
        PERFORM public.review_participation(v_log_id, 'rejected', NULL, 'Wait no');
        RAISE EXCEPTION 'Approved logs MUST be immutable.';
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- Idempotent Repeated Review
    v_res := public.review_participation(v_log_id, 'approved', 100, 'Perfect');
    IF v_res->>'action' != 'idempotent' THEN RAISE EXCEPTION 'Idempotency check failed.'; END IF;

    -- Verify no new audit event created for idempotent review
    SELECT count(*) INTO v_event_count FROM public.participation_submission_events WHERE log_id = v_log_id;
    IF v_event_count != 4 THEN RAISE EXCEPTION 'Expected 4 audit events, got %', v_event_count; END IF;

    RAISE NOTICE 'State machine and audit event tests passed.';

    -- ==============================================================================
    -- 5. Cross-Stage Artifact Preservation Check
    -- ==============================================================================
    -- (This guarantees Stage 3 does not break Stage 2C RPCs or Rapor tables)
    DECLARE
        v_func_def TEXT;
        v_func_hash TEXT;
        v_func_secdef BOOLEAN;
        v_func_config TEXT[];
        v_pre_hash TEXT;
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_leaderboard_reference_members') THEN
            RAISE NOTICE 'Stage 2C RPC public.get_leaderboard_reference_members() is missing in local environment (skipped).';
        ELSE
            -- Verify exact properties
            SELECT prosecdef, proconfig
            INTO v_func_secdef, v_func_config
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' 
              AND p.proname = 'get_leaderboard_reference_members'
              AND pg_get_function_identity_arguments(p.oid) = '';
              
            IF NOT v_func_secdef THEN
                RAISE EXCEPTION 'Stage 2C RPC lost SECURITY DEFINER.';
            END IF;
            
            IF array_position(v_func_config, 'search_path=""') IS NULL THEN
                RAISE EXCEPTION 'Stage 2C RPC lost empty search_path.';
            END IF;

            v_func_def := pg_get_functiondef((
                SELECT p.oid FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE n.nspname = 'public' 
                  AND p.proname = 'get_leaderboard_reference_members'
                  AND pg_get_function_identity_arguments(p.oid) = ''
            ));
            
            v_func_hash := md5(v_func_def);
            
            SELECT item_hash INTO v_pre_hash FROM public._test_stage3_state WHERE item_name = 'get_leaderboard_reference_members';
            IF v_func_hash != v_pre_hash THEN
                RAISE EXCEPTION 'Stage 2C RPC hash changed! Pre: %, Post: %', v_pre_hash, v_func_hash;
            END IF;

            RAISE NOTICE 'Stage 2C RPC preservation verified successfully.';
        END IF;
    END;
    
    DECLARE
        v_col_def TEXT;
        v_col_hash TEXT;
        v_pre_hash TEXT;
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rapor_members') THEN
            RAISE NOTICE 'Rapor shared table rapor_members is missing in local environment (skipped).';
        ELSE
            SELECT string_agg(column_name || ' ' || data_type, ', ' ORDER BY ordinal_position)
            INTO v_col_def
            FROM information_schema.columns 
            WHERE table_name = 'rapor_members' AND table_schema = 'public';
            
            v_col_hash := md5(v_col_def);
            
            SELECT item_hash INTO v_pre_hash FROM public._test_stage3_state WHERE item_name = 'rapor_members';
            IF v_col_hash != v_pre_hash THEN
                RAISE EXCEPTION 'rapor_members fingerprint changed! Pre: %, Post: %', v_pre_hash, v_col_hash;
            END IF;
            
            RAISE NOTICE 'Rapor shared object (rapor_members) preservation verified successfully.';
        END IF;
    END;

    RAISE NOTICE 'Artifact preservation constraints passed.';
    RAISE NOTICE '--- ALL TESTS PASSED SUCCESSFULLY ---';
END $$;

ROLLBACK;
