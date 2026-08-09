import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

function searchFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      searchFiles(fullPath, fileList);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

test('Static Analysis: No direct-write paths to protected tables', async (t) => {
  const srcFiles = searchFiles(path.join(process.cwd(), 'src'));
  const protectedTables = ['participation_logs', 'participation_submission_events', 'audit_events', 'verification_requests'];
  
  // Regex to catch .from('protected_table').insert / update / delete / upsert
  const writeRegex = new RegExp(`from\\(\\s*['"\`]?(${protectedTables.join('|')})['"\`]?\\s*\\)\\s*\\.\\s*(insert|update|delete|upsert)`);

  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const match = content.match(writeRegex);
    assert.ok(!match, `Found direct write to ${match?.[1]} via ${match?.[2]} in ${file}`);
  }
});

test('Static Analysis: Stage 4 changes only the additive shared-identity namespace', () => {
  const stage4Path = path.join(process.cwd(), 'deployment', 'remote', 'stage4_identity_and_public_reads.sql');
  const stage4 = fs.readFileSync(stage4Path, 'utf8');

  assert.doesNotMatch(
    stage4,
    /\b(?:insert\s+into|update|delete\s+from|alter\s+table|drop\s+table|create\s+table)\s+public\.rapor_/i,
    'Stage 4 must treat every Rapor table as read-only.',
  );
  assert.doesNotMatch(
    stage4,
    /\b(?:alter\s+table|drop\s+table|create\s+table)\s+public\.(?:users|profiles|members|member_release_links|participation_logs|competitions|rapor_[a-z_]+)/i,
    'Stage 4 must not alter, drop, or recreate any protected existing table.',
  );

  const createdPublicTables = [...stage4.matchAll(/\bcreate\s+table\s+public\.([a-z_]+)/gi)]
    .map((match) => match[1]);
  assert.deepEqual(createdPublicTables, ['arsc_identities']);

  assert.match(stage4, /references\s+auth\.users\s*\(id\)/i);
  assert.match(stage4, /references\s+public\.members\s*\(id\)/i);
  assert.match(stage4, /Rapor identity is already linked to another account/i);
});

test('Static Analysis: admin grant only changes the Leaderboard role assignment', () => {
  const grantPath = path.join(process.cwd(), 'deployment', 'remote', 'grant_leaderboard_admin.sql');
  const grantSql = fs.readFileSync(grantPath, 'utf8');

  assert.match(grantSql, /BEGIN;/i);
  assert.match(grantSql, /COMMIT;/i);
  assert.match(grantSql, /INSERT\s+INTO\s+public\.user_roles/i);
  assert.match(grantSql, /ON\s+CONFLICT\s*\(user_id,\s*role\)\s+DO\s+NOTHING/i);
  assert.doesNotMatch(
    grantSql,
    /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:users|profiles|rapor_[a-z_]+|participation_logs)/i,
    'Admin assignment must not mutate Halo, Rapor, profile, or participation records.',
  );
});

test('Static Analysis: auth callback never waits on database reads while the auth lock is held', () => {
  const authPath = path.join(process.cwd(), 'src', 'hooks', 'useAuth.tsx');
  const authSource = fs.readFileSync(authPath, 'utf8');

  assert.doesNotMatch(
    authSource,
    /onAuthStateChange\(\s*async/i,
    'Supabase auth callbacks must remain synchronous to avoid lock contention.',
  );
  assert.match(authSource, /setTimeout\([\s\S]*applySession/i);
  assert.match(authSource, /visibilitychange/);
  assert.match(authSource, /addEventListener\('online'/);
});

test('Static Analysis: participation form reuses account identity state', () => {
  const modalPath = path.join(process.cwd(), 'src', 'components', 'modals', 'ParticipationModal.tsx');
  const pagePath = path.join(process.cwd(), 'app', 'page.tsx');
  const modalSource = fs.readFileSync(modalPath, 'utf8');
  const pageSource = fs.readFileSync(pagePath, 'utf8');

  assert.doesNotMatch(
    modalSource,
    /\.from\(\s*['"]profiles['"]\s*\)/,
    'The participation form must not duplicate the account profile query.',
  );
  assert.match(modalSource, /linkStatus:\s*string\s*\|\s*null/);
  assert.match(pageSource, /<ParticipationModal[\s\S]*linkStatus=\{linkStatus\}/);
});
