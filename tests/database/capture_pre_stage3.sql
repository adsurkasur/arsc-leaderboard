CREATE TABLE IF NOT EXISTS public._test_stage3_state (
    item_name TEXT PRIMARY KEY,
    item_hash TEXT NOT NULL
);

TRUNCATE public._test_stage3_state;

DO $$
DECLARE
    v_func_def TEXT;
    v_col_def TEXT;
BEGIN
    -- Capture get_leaderboard_reference_members
    v_func_def := pg_get_functiondef((
        SELECT p.oid FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
          AND p.proname = 'get_leaderboard_reference_members'
          AND pg_get_function_identity_arguments(p.oid) = ''
    ));
    
    INSERT INTO public._test_stage3_state (item_name, item_hash)
    VALUES ('get_leaderboard_reference_members', md5(v_func_def));

    -- Capture rapor_members
    SELECT string_agg(column_name || ' ' || data_type, ', ' ORDER BY ordinal_position)
    INTO v_col_def
    FROM information_schema.columns 
    WHERE table_name = 'rapor_members' AND table_schema = 'public';

    INSERT INTO public._test_stage3_state (item_name, item_hash)
    VALUES ('rapor_members', md5(v_col_def));

    RAISE NOTICE 'Captured pre-Stage-3 state.';
END $$;
