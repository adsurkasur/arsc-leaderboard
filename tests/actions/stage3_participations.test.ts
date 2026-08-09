/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, mock } from 'node:test';
import assert from 'node:assert';

mock.module('next/headers', {
  namedExports: {
    cookies: async () => ({
      getAll: () => [],
      set: () => {},
      get: () => null,
    }),
  },
});

mock.module('@/lib/supabase/server', {
  namedExports: {
    createClient: async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: 'admin1' } }, error: null }),
      },
      rpc: async (fn: string, args: unknown) => {
        (globalThis as any).mockRpcLastArgs = { fn, args };
        return { data: { success: true }, error: null };
      },
    }),
  },
});

const { reviewParticipation, submitParticipation } = await import(
  '../../src/lib/actions/stage3_participations'
);

test('Stage 5 participation actions use configured scoring rules', async (t) => {
  t.beforeEach(() => {
    (globalThis as any).mockRpcLastArgs = null;
  });

  await t.test('submits the selected competition scoring rule', async () => {
    const result = await submitParticipation(
      'competition-123',
      'rule-juara-1',
      'https://example.com/proof',
    );

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual((globalThis as any).mockRpcLastArgs, {
      fn: 'submit_participation_v2',
      args: {
        p_competition_id: 'competition-123',
        p_scoring_rule_id: 'rule-juara-1',
        p_evidence_url: 'https://example.com/proof',
      },
    });
  });

  await t.test('approves using a rule id instead of a free-form point value', async () => {
    const result = await reviewParticipation(
      'log123',
      'approved',
      'rule-finalis',
      'Bukti sesuai',
    );

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual((globalThis as any).mockRpcLastArgs, {
      fn: 'review_participation_v2',
      args: {
        p_log_id: 'log123',
        p_status: 'approved',
        p_scoring_rule_id: 'rule-finalis',
        p_notes: 'Bukti sesuai',
      },
    });
  });

  await t.test('rejects without assigning a scoring rule', async () => {
    const result = await reviewParticipation('log123', 'rejected', null, 'Bukti belum cukup');

    assert.strictEqual(result.success, true);
    assert.strictEqual((globalThis as any).mockRpcLastArgs.args.p_scoring_rule_id, null);
  });
});
