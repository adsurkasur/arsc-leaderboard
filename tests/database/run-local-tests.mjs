import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const projectId = 'achoqkifkarwforhivee';
const container = `supabase_db_${projectId}`;

function runSql(label, sql) {
  process.stdout.write(`${label}\n`);
  const result = spawnSync(
    'docker',
    ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit'] },
  );

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`);
  }
}

function sqlFile(path) {
  return readFileSync(resolve(path), 'utf8');
}

runSql(
  'Resetting local integration fixtures and Stage 4 objects...',
  `
    DROP TABLE IF EXISTS public.arsc_identities CASCADE;
    DROP TABLE IF EXISTS public.users CASCADE;
    DROP TABLE IF EXISTS public.rapor_access_codes CASCADE;
    DROP TABLE IF EXISTS public.rapor_releases CASCADE;
    DROP TABLE IF EXISTS public.rapor_members CASCADE;
    DROP FUNCTION IF EXISTS public.submit_participation(uuid, text);
    DROP FUNCTION IF EXISTS public.review_participation(uuid, text, integer, text);
    DROP FUNCTION IF EXISTS public.review_participation(uuid, text, text, integer, text);
    DROP FUNCTION IF EXISTS public.get_public_leaderboard();
    DROP FUNCTION IF EXISTS public.get_public_member_participations(uuid);
    DROP FUNCTION IF EXISTS public.get_public_category_participation_counts(text);
    DROP FUNCTION IF EXISTS public.upsert_leaderboard_reference_member(text, text, text, text, text);
    DROP FUNCTION IF EXISTS public.link_leaderboard_profile_from_reference(uuid, text, text, text, text, text);
    DROP FUNCTION IF EXISTS public.link_arsc_account_from_reference(uuid, text, text, text, text, text);
    DROP FUNCTION IF EXISTS public.get_my_arsc_identity();
    DROP FUNCTION IF EXISTS public.set_shared_profile_avatar(uuid, text);
    DROP TRIGGER IF EXISTS arsc_verified_profile_guard ON public.profiles;
    DROP FUNCTION IF EXISTS public.protect_verified_arsc_identity_fields();
    DROP FUNCTION IF EXISTS public.protect_verified_leaderboard_identity_fields();
    DROP FUNCTION IF EXISTS public.sync_halo_avatar_to_leaderboard();
  `,
);

runSql('Applying Rapor mock tables...', sqlFile('tests/database/mock_rapor_tables.sql'));
runSql('Applying Halo PSDM profile fixture...', sqlFile('tests/database/mock_halo_identity.sql'));
runSql('Applying Stage 2C RPC fixture...', sqlFile('tests/database/setup_stage2c_rpc.sql'));
runSql('Capturing protected pre-Stage-3 state...', sqlFile('tests/database/capture_pre_stage3.sql'));
runSql('Applying hardened Stage 3 artifact...', sqlFile('deployment/remote/stage3_restricted_write.sql'));
runSql('Running Stage 3 validation...', sqlFile('tests/database/test_stage3.sql'));
runSql(
  'Running exportable read-only Stage 4 preflight...',
  sqlFile('deployment/remote/preflight_stage4_identity_single_result.sql'),
);
runSql('Applying additive Stage 4 artifact...', sqlFile('deployment/remote/stage4_identity_and_public_reads.sql'));
runSql('Running Stage 4 shared identity validation...', sqlFile('tests/database/test_stage4_identity.sql'));
runSql('Running read-only Stage 4 verification...', sqlFile('deployment/remote/verify_stage4_identity.sql'));
runSql('Cleaning local test state...', 'DROP TABLE IF EXISTS public._test_stage3_state;');

process.stdout.write('All database integration tests passed.\n');
