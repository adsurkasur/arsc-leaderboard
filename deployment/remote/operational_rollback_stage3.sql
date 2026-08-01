-- ==============================================================================
-- Stage 3 Operational Rollback (Non-destructive)
-- Execute via Supabase Dashboard SQL Editor if Stage 3 needs to be halted.
-- MUST RUN INSIDE AN EXPLICIT TRANSACTION.
-- ==============================================================================

BEGIN;

DO $$
BEGIN
    RAISE NOTICE 'Starting non-destructive operational rollback for Stage 3...';

    -- 1. Revoke execution privileges on Stage 3 RPCs explicitly using signatures
    -- This prevents the application (or any authenticated user) from making new submissions or reviews.
    REVOKE EXECUTE ON FUNCTION public.submit_participation(UUID, TEXT) FROM authenticated, anon, PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.review_participation(UUID, TEXT, INTEGER, TEXT) FROM authenticated, anon, PUBLIC;
    
    RAISE NOTICE 'Revoked execution privileges on Stage 3 RPCs.';

    -- 2. Restore permissive policies on participation_logs to allow the application to read gracefully
    -- while writes are blocked.
    
    -- Ensure no direct inserts/updates/deletes are possible via REST
    REVOKE INSERT, UPDATE, DELETE ON public.participation_logs FROM authenticated, anon, PUBLIC;
    
    RAISE NOTICE 'Ensured REST writes to participation_logs remain blocked.';

    -- 3. Ensure no direct inserts to events table
    REVOKE INSERT, UPDATE, DELETE ON public.participation_submission_events FROM authenticated, anon, PUBLIC;
    RAISE NOTICE 'Ensured REST writes to participation_submission_events remain blocked.';

    -- 4. Preserve data
    -- No tables, columns, or data are dropped. The schema remains intact.
    RAISE NOTICE 'All tables, rows, and audit history have been preserved.';
    RAISE NOTICE 'Stage 3 writes have been effectively paused.';

END $$;

COMMIT;
