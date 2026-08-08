import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const contract = JSON.parse(readFileSync('contracts/rapor-leaderboard.v1.json', 'utf8'));
const sharedIdentity = JSON.parse(readFileSync('contracts/arsc-shared-identity.v1.json', 'utf8'));
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
assert.equal(sharedIdentity.auth.canonicalKey, 'auth.users.id');
assert.equal(sharedIdentity.projections.haloProfile, 'public.users.id');
assert.equal(sharedIdentity.projections.leaderboardProfile, 'public.profiles.user_id');
assert.equal(sharedIdentity.verification.linkRpc, 'public.link_arsc_account_from_reference');

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
assert.match(stage4, /CREATE TABLE public\.arsc_identities/);
assert.match(stage4, /REFERENCES auth\.users\(id\)/);
assert.match(stage4, /REFERENCES public\.members\(id\)/);
assert.match(stage4, /INSERT INTO public\.users/);
assert.match(stage4, /INSERT INTO public\.profiles/);
assert.match(stage4, /REVOKE ALL ON FUNCTION public\.link_arsc_account_from_reference[\s\S]+FROM PUBLIC, anon, authenticated/);
assert.match(stage4, /GRANT EXECUTE ON FUNCTION public\.link_arsc_account_from_reference[\s\S]+TO service_role/);

process.stdout.write('Rapor-Leaderboard consumer contract passed.\n');
