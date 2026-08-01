# Run Stage 3 Tests locally against Supabase Docker container

$db_container = "supabase_db_achoqkifkarwforhivee"

Write-Host "Applying Rapor mock tables..."
cmd /c "docker exec -i $db_container psql -U postgres -c `"DROP TABLE IF EXISTS public.rapor_releases CASCADE; DROP TABLE IF EXISTS public.rapor_members CASCADE;`""
cmd /c "docker exec -i $db_container psql -U postgres < tests\database\mock_rapor_tables.sql"

Write-Host "Applying Stage 2C RPC fixture..."
cmd /c "docker exec -i $db_container psql -U postgres < tests\database\setup_stage2c_rpc.sql"

Write-Host "Cleaning up local buggy RPCs to allow deployment..."
cmd /c "docker exec -i $db_container psql -U postgres -c `"DROP FUNCTION IF EXISTS public.submit_participation(UUID, TEXT); DROP FUNCTION IF EXISTS public.review_participation(UUID, TEXT, INTEGER, TEXT); DROP FUNCTION IF EXISTS public.review_participation(UUID, TEXT, TEXT, INTEGER, TEXT);`""

Write-Host "Capturing pre-Stage-3 state..."
cmd /c "docker exec -i $db_container psql -U postgres < tests\database\capture_pre_stage3.sql"

Write-Host "Deploying hardened Stage 3 scripts..."
cmd /c "docker exec -i $db_container psql -U postgres < deployment\remote\stage3_restricted_write.sql"

Write-Host "Running Stage 3 validation suite..."
cmd /c "docker exec -i $db_container psql -U postgres < tests\database\test_stage3.sql"

Write-Host "Cleaning up state capture..."
cmd /c "docker exec -i $db_container psql -U postgres -c `"DROP TABLE IF EXISTS public._test_stage3_state;`""

Write-Host "Done."
