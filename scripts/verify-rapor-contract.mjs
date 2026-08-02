import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const contract = JSON.parse(readFileSync('contracts/rapor-leaderboard.v1.json', 'utf8'));
const identityAction = readFileSync('src/lib/actions/raporIdentity.ts', 'utf8');
const syncAction = readFileSync('src/lib/actions/syncRapor.ts', 'utf8');
const identityHelper = readFileSync('src/lib/rapor/identity.ts', 'utf8');
const stage4 = readFileSync('deployment/remote/stage4_identity_and_public_reads.sql', 'utf8');

assert.equal(contract.version, 1);
assert.deepEqual(contract.referenceRpc.columns, [
  'release_member_code',
  'release_code',
  'canonical_name',
  'unit',
  'position',
]);
assert.equal(contract.referenceRpc.executeRole, 'service_role');
assert.equal(contract.accessCode.pepperEnvironmentVariable, 'RAPOR_ACCESS_CODE_PEPPER');

for (const field of contract.referenceRpc.columns) {
  assert.match(syncAction, new RegExp(`\\b${field}\\b`), `Consumer is missing ${field}.`);
}

assert.match(syncAction, /get_leaderboard_reference_members/);
assert.match(syncAction, /upsert_leaderboard_reference_member/);
assert.match(identityAction, /RAPOR_ACCESS_CODE_PEPPER/);
assert.match(identityAction, /rapor_access_codes/);
assert.match(identityAction, /rapor_releases!inner\(status, is_active\)/);
assert.match(identityHelper, /createHash\('sha256'\)/);
assert.match(identityHelper, /trim\(\)\.toLowerCase\(\)/);
assert.match(identityHelper, /::/);
assert.match(stage4, /REVOKE ALL ON FUNCTION public\.link_leaderboard_profile_from_reference[\s\S]+FROM PUBLIC, anon, authenticated/);
assert.match(stage4, /GRANT EXECUTE ON FUNCTION public\.link_leaderboard_profile_from_reference[\s\S]+TO service_role/);

process.stdout.write('Rapor-Leaderboard consumer contract passed.\n');
