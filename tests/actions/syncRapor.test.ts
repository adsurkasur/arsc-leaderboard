import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

type ReferenceRow = {
  release_member_code: string;
  release_code: string;
  canonical_name: string;
  unit: string;
  position: string | null;
};

const state: {
  user: { id: string } | null;
  userError: Error | null;
  adminRole: { role: string } | null;
  adminError: Error | null;
  references: ReferenceRow[];
  integrationClientCreated: boolean;
  rpcCalls: Array<{ name: string; args?: Record<string, unknown> }>;
} = {
  user: null,
  userError: null,
  adminRole: null,
  adminError: null,
  references: [],
  integrationClientCreated: false,
  rpcCalls: [],
};

mock.module('@/lib/supabase/server', {
  namedExports: {
    createClient: async () => ({
      auth: {
        getUser: async () => ({
          data: { user: state.user },
          error: state.userError,
        }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: state.adminRole, error: state.adminError }),
            }),
          }),
        }),
      }),
    }),
  },
});

mock.module('@supabase/supabase-js', {
  namedExports: {
    createClient: () => {
      state.integrationClientCreated = true;
      return {
        rpc: async (name: string, args?: Record<string, unknown>) => {
          state.rpcCalls.push({ name, args });
          if (name === 'get_leaderboard_reference_members') {
            return { data: state.references, error: null };
          }
          if (name === 'upsert_leaderboard_reference_member') {
            return { data: { created: true }, error: null };
          }
          return { data: null, error: new Error(`Unexpected RPC: ${name}`) };
        },
      };
    },
  },
});

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_INTEGRATION_SERVICE_KEY = 'local-test-service-key';

const { syncRaporMembers } = await import('../../src/lib/actions/syncRapor.ts');

test('syncRaporMembers keeps the Rapor integration behind the admin boundary', async (t) => {
  t.beforeEach(() => {
    state.user = null;
    state.userError = null;
    state.adminRole = null;
    state.adminError = null;
    state.references = [];
    state.integrationClientCreated = false;
    state.rpcCalls = [];
  });

  await t.test('rejects an invalid session before creating the integration client', async () => {
    state.userError = new Error('session missing');

    const result = await syncRaporMembers();

    assert.equal(result.success, false);
    assert.match(result.error || '', /Missing or invalid authenticated session/);
    assert.equal(state.integrationClientCreated, false);
  });

  await t.test('rejects a non-admin before reading the Rapor reference RPC', async () => {
    state.user = { id: 'member-1' };

    const result = await syncRaporMembers();

    assert.equal(result.success, false);
    assert.match(result.error || '', /Requires Leaderboard admin role/);
    assert.equal(state.integrationClientCreated, false);
  });

  await t.test('accepts an admin and handles an empty active release', async () => {
    state.user = { id: 'admin-1' };
    state.adminRole = { role: 'admin' };

    const result = await syncRaporMembers();

    assert.equal(result.success, true);
    assert.equal(state.integrationClientCreated, true);
    assert.deepEqual(state.rpcCalls.map((call) => call.name), ['get_leaderboard_reference_members']);
  });

  await t.test('maps the producer contract into the Leaderboard upsert RPC', async () => {
    state.user = { id: 'admin-1' };
    state.adminRole = { role: 'admin' };
    state.references = [{
      release_member_code: 'RTP_2026_001',
      release_code: 'RTP_2026',
      canonical_name: 'Anggota Contoh',
      unit: 'RISTEK',
      position: 'Staf',
    }];

    const result = await syncRaporMembers();

    assert.equal(result.success, true);
    assert.deepEqual(state.rpcCalls[1], {
      name: 'upsert_leaderboard_reference_member',
      args: {
        p_release_member_code: 'RTP_2026_001',
        p_release_code: 'RTP_2026',
        p_canonical_name: 'Anggota Contoh',
        p_unit: 'RISTEK',
        p_position: 'Staf',
      },
    });
  });
});
