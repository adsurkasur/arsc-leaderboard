import test from 'node:test';
import assert from 'node:assert';

// Global mock state variables mapped to our custom mocks
declare global {
  var mockUser: Record<string, unknown> | null;
  var mockUserError: Error | null;
  var mockProfile: Record<string, unknown> | null;
  var mockProfileError: Error | null;
  var createdIntegrationClient: boolean;
}

// Ensure env vars are present BEFORE importing syncRapor.ts
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_INTEGRATION_SERVICE_KEY = 'mock_secret_key';

// Dynamically import to ensure env vars are picked up at module load time
const { syncRaporMembers } = await import('../../src/lib/actions/syncRapor.ts');

test('syncRaporMembers Auth Flow Tests', async (t) => {
  t.beforeEach(() => {
    globalThis.createdIntegrationClient = false;
    globalThis.mockUser = null;
    globalThis.mockUserError = null;
    globalThis.mockProfile = null;
    globalThis.mockProfileError = null;
  });

  await t.test('1. Missing/Invalid session is rejected', async () => {
    globalThis.mockUser = null;
    globalThis.mockUserError = new Error('Auth session missing!');

    const result = await syncRaporMembers();
    assert.strictEqual(result.success, false);
    assert.match(result.error || '', /Missing or invalid authenticated session/);
    assert.strictEqual(globalThis.createdIntegrationClient, false, 'Integration client should not be instantiated');
  });

  await t.test('2. Authenticated non-admin is rejected', async () => {
    globalThis.mockUser = { id: 'user_123' };
    globalThis.mockProfile = { role: 'user' };

    const result = await syncRaporMembers();
    assert.strictEqual(result.success, false);
    assert.match(result.error || '', /Requires Leaderboard admin role/);
    assert.strictEqual(globalThis.createdIntegrationClient, false, 'Integration client should not be instantiated');
  });

  await t.test('3. Authenticated admin reaches the sync path', async () => {
    globalThis.mockUser = { id: 'admin_123' };
    globalThis.mockProfile = { role: 'admin' };

    const result = await syncRaporMembers();
    // It should succeed or fail at RPC, but we mocked RPC to return empty []
    assert.strictEqual(result.success, true);
    assert.strictEqual(globalThis.createdIntegrationClient, true, 'Integration client MUST be instantiated for admin');
  });
});
