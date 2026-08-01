/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, mock } from 'node:test';
import assert from 'node:assert';

// Mock next/headers FIRST, before importing the action
mock.module('next/headers', {
  namedExports: {
    cookies: async () => ({
      getAll: () => [],
      set: () => {},
      get: (name: string) => null,
    }),
  }
});

mock.module('@/lib/supabase/server', {
  namedExports: {
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: 'admin1' } }, error: null }) },
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: 'admin' }, error: null }) }) }) }) }),
      rpc: async (fn: string, args: any) => {
        (globalThis as any).mockRpcLastArgs = { fn, args };
        return { data: { success: true }, error: null };
      }
    })
  }
});

const { reviewParticipation } = await import('../../src/lib/actions/stage3_participations');

test('Action-Layer Test: reviewParticipation', async (t) => {
  t.beforeEach(() => {
    (globalThis as any).mockRpcLastArgs = null;
  });

  await t.test('Forwards 0 points correctly', async () => {
    const result = await reviewParticipation('log123', 'approved', 0, 'notes here');
    assert.strictEqual(result.success, true);
    
    const rpcArgs = (globalThis as any).mockRpcLastArgs;
    assert.ok(rpcArgs, 'RPC should have been called');
    assert.strictEqual(rpcArgs.fn, 'review_participation');
    assert.strictEqual(rpcArgs.args.p_points, 0, 'Should forward 0 instead of converting to null');
  });

  await t.test('Forwards null if undefined/null provided', async () => {
    const result = await reviewParticipation('log123', 'approved', null, 'notes');
    assert.strictEqual(result.success, true);
    assert.strictEqual((globalThis as any).mockRpcLastArgs.args.p_points, null);
  });
});
