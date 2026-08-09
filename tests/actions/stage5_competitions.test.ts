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
        (globalThis as any).stage5CompetitionRpcCalls.push({ fn, args });
        (globalThis as any).stage5CompetitionRpc = { fn, args };
        if ((globalThis as any).stage6CompetitionRpcMissing && fn === 'leaderboard_save_competition_v2') {
          return {
            data: null,
            error: { code: 'PGRST202', message: 'Could not find leaderboard_save_competition_v2' },
          };
        }
        return { data: { success: true, competition_id: 'competition-1' }, error: null };
      },
    }),
  },
});

const { saveCompetition } = await import('../../src/lib/actions/stage5_competitions');

function competitionInput() {
  return {
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
    tracks: [
      { name: 'UI/UX Design' },
      { name: 'Data Mining' },
    ],
  };
}

test('Stage 6 competition action sends one atomic competition, rules, and tracks command', async () => {
  (globalThis as any).stage5CompetitionRpcCalls = [];
  (globalThis as any).stage6CompetitionRpcMissing = false;
  const result = await saveCompetition(competitionInput());

  assert.strictEqual(result.success, true);
  assert.deepStrictEqual((globalThis as any).stage5CompetitionRpc, {
    fn: 'leaderboard_save_competition_v2',
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
      p_tracks: [
        { name: 'UI/UX Design' },
        { name: 'Data Mining' },
      ],
    },
  });
});

test('competition action preserves Stage 5 editing before Stage 6 is deployed', async () => {
  (globalThis as any).stage5CompetitionRpcCalls = [];
  (globalThis as any).stage6CompetitionRpcMissing = true;

  const result = await saveCompetition(competitionInput());

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.stage6Ready, false);
  assert.deepStrictEqual(
    (globalThis as any).stage5CompetitionRpcCalls.map((call: { fn: string }) => call.fn),
    ['leaderboard_save_competition_v2', 'leaderboard_save_competition'],
  );
  assert.strictEqual((globalThis as any).stage5CompetitionRpc.args.p_tracks, undefined);
});
