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
  'Resetting local integration fixtures and Stage 4/5/6 objects...',
  `
    DROP FUNCTION IF EXISTS public.leaderboard_save_competition_v2(uuid, text, date, text, text, boolean, uuid, jsonb, jsonb);
    DROP FUNCTION IF EXISTS public.submit_participation_v3(uuid, uuid, uuid, text);
    DROP FUNCTION IF EXISTS public.submit_competition_proposal(text, text, text, date, text, text, text, text, text);
    DROP FUNCTION IF EXISTS public.review_competition_proposal(
      uuid, text, text, uuid, text, date, text, text, boolean, uuid, jsonb, jsonb, uuid, text, text
    );
    DROP FUNCTION IF EXISTS public.get_public_member_participations_v3(uuid);
    DROP TABLE IF EXISTS public.leaderboard_competition_proposals CASCADE;
    DROP TABLE IF EXISTS public.leaderboard_competition_tracks CASCADE;
    DROP FUNCTION IF EXISTS public.leaderboard_has_role(uuid, text);
    DROP FUNCTION IF EXISTS public.leaderboard_has_role(uuid, public.app_role);
    ALTER TABLE IF EXISTS public.participation_submission_events
      DROP COLUMN IF EXISTS competition_track_id,
      DROP COLUMN IF EXISTS competition_track_name;
    ALTER TABLE IF EXISTS public.participation_logs
      DROP COLUMN IF EXISTS competition_track_id;
    DO $reset_stage6$
    BEGIN
      IF to_regclass('public.participation_logs') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM pg_constraint constraint_row
          WHERE constraint_row.conrelid = 'public.participation_logs'::regclass
            AND constraint_row.contype = 'u'
            AND (
              SELECT array_agg(attribute_row.attname::text ORDER BY attribute_row.attname::text)
              FROM unnest(constraint_row.conkey) AS key_row(attnum)
              JOIN pg_attribute attribute_row
                ON attribute_row.attrelid = constraint_row.conrelid
               AND attribute_row.attnum = key_row.attnum
            ) = ARRAY['competition_id', 'profile_id']::text[]
        )
      THEN
        ALTER TABLE public.participation_logs
          ADD CONSTRAINT participation_logs_profile_id_competition_id_key
          UNIQUE (profile_id, competition_id);
      END IF;
    END;
    $reset_stage6$;
    DROP FUNCTION IF EXISTS public.leaderboard_save_competition(uuid, text, date, text, text, boolean, uuid, jsonb);
    DROP FUNCTION IF EXISTS public.submit_participation_v2(uuid, uuid, text);
    DROP FUNCTION IF EXISTS public.review_participation_v2(uuid, text, uuid, text);
    DROP FUNCTION IF EXISTS public.get_public_leaderboard_v2();
    DROP FUNCTION IF EXISTS public.get_public_member_participations_v2(uuid);
    DROP FUNCTION IF EXISTS public.get_public_category_scores_v2(text);
    ALTER TABLE IF EXISTS public.participation_submission_events
      DROP COLUMN IF EXISTS scoring_rule_id,
      DROP COLUMN IF EXISTS achievement;
    ALTER TABLE IF EXISTS public.participation_logs
      DROP CONSTRAINT IF EXISTS check_log_achievement_not_empty,
      DROP CONSTRAINT IF EXISTS participation_logs_awarded_achievement_check,
      DROP COLUMN IF EXISTS achievement,
      DROP COLUMN IF EXISTS requested_scoring_rule_id,
      DROP COLUMN IF EXISTS awarded_scoring_rule_id,
      DROP COLUMN IF EXISTS requested_achievement,
      DROP COLUMN IF EXISTS awarded_achievement,
      DROP COLUMN IF EXISTS requested_points;
    ALTER TABLE IF EXISTS public.competitions
      DROP COLUMN IF EXISTS scoring_template_id,
      DROP COLUMN IF EXISTS is_active;
    DROP TABLE IF EXISTS public.leaderboard_competition_scoring_rules CASCADE;
    DROP TABLE IF EXISTS public.leaderboard_scoring_template_rules CASCADE;
    DROP TABLE IF EXISTS public.leaderboard_scoring_templates CASCADE;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitions TO authenticated;
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
runSql('Running read-only Stage 5 preflight...', sqlFile('deployment/remote/preflight_stage5_scoring.sql'));
runSql('Applying additive Stage 5 scoring artifact...', sqlFile('deployment/remote/stage5_configurable_scoring.sql'));
runSql('Running Stage 5 configurable scoring validation...', sqlFile('tests/database/test_stage5_scoring.sql'));
runSql('Running read-only Stage 5 verification...', sqlFile('deployment/remote/verify_stage5_scoring.sql'));
runSql('Running read-only Stage 6 preflight...', sqlFile('deployment/remote/preflight_stage6_competition_proposals.sql'));
runSql('Applying additive Stage 6 competition proposal artifact...', sqlFile('deployment/remote/stage6_competition_proposals.sql'));
runSql('Running Stage 6 competition proposal validation...', sqlFile('tests/database/test_stage6_competition_proposals.sql'));
runSql('Running read-only Stage 6 verification...', sqlFile('deployment/remote/verify_stage6_competition_proposals.sql'));
runSql('Cleaning local test state...', 'DROP TABLE IF EXISTS public._test_stage3_state;');

process.stdout.write('All database integration tests passed.\n');
