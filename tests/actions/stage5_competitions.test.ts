/* eslint-disable @typescript-eslint/no-explicit-any */
import { mock, test } from 'node:test';
import assert from 'node:assert';

mock.module('next/headers', {
  namedExports: {
    cookies: async () => ({ getAll: () => [], set: () => {}, get: () => null }),
  },
});

mock.module('@/lib/supabase/server', {
  namedExports: {
    createClient: async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: 'admin-1' } }, error: null }),
      },
      rpc: async (fn: string, args: unknown) => {
        (globalThis as any).stage5CompetitionRpc = { fn, args };
        return { data: { success: true, competition_id: 'competition-1' }, error: null };
      },
    }),
  },
});

const { saveCompetition } = await import('../../src/lib/actions/stage5_competitions');

test('Stage 5 competition action sends one atomic competition-and-rules command', async () => {
  const result = await saveCompetition({
    title: 'Gemastik 2026',
    date: '2026-08-09',
    description: 'Kompetisi nasional',
    category: 'Nasional',
    isActive: true,
    templateId: 'template-national',
    rules: [
      { label: 'Juara 1', points: 50, sort_order: 10 },
      { label: 'Finalis', points: 18, sort_order: 20 },
    ],
  });

  assert.strictEqual(result.success, true);
  assert.deepStrictEqual((globalThis as any).stage5CompetitionRpc, {
    fn: 'leaderboard_save_competition',
    args: {
      p_competition_id: null,
      p_title: 'Gemastik 2026',
      p_date: '2026-08-09',
      p_description: 'Kompetisi nasional',
      p_category: 'Nasional',
      p_is_active: true,
      p_template_id: 'template-national',
      p_rules: [
        { label: 'Juara 1', points: 50, sort_order: 10 },
        { label: 'Finalis', points: 18, sort_order: 20 },
      ],
    },
  });
});
