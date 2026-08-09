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
      auth: { getUser: async () => ({ data: { user: { id: 'member-1' } }, error: null }) },
      rpc: async (fn: string, args: unknown) => {
        (globalThis as any).stage6ProposalRpc = { fn, args };
        return { data: { success: true }, error: null };
      },
    }),
  },
});

const { submitCompetitionProposal, reviewCompetitionProposal } = await import(
  '../../src/lib/actions/stage6_proposals'
);

test('member proposal action sends catalogue and participation evidence atomically', async () => {
  const result = await submitCompetitionProposal({
    title: 'ARSC Innovation Challenge',
    organizer: 'ARSC UB',
    informationUrl: 'https://example.com/info',
    date: '2026-08-10',
    level: 'Internal ARSC',
    trackName: 'Poster Digital',
    achievement: 'Finalis',
    evidenceUrl: 'https://example.com/proof',
    memberNotes: 'Mohon ditinjau',
  });

  assert.strictEqual(result.success, true);
  assert.deepStrictEqual((globalThis as any).stage6ProposalRpc, {
    fn: 'submit_competition_proposal',
    args: {
      p_title: 'ARSC Innovation Challenge',
      p_organizer: 'ARSC UB',
      p_information_url: 'https://example.com/info',
      p_date: '2026-08-10',
      p_level: 'Internal ARSC',
      p_track_name: 'Poster Digital',
      p_achievement: 'Finalis',
      p_evidence_url: 'https://example.com/proof',
      p_member_notes: 'Mohon ditinjau',
    },
  });
});

test('admin acceptance maps a proposal to a scoring rule without direct writes', async () => {
  const result = await reviewCompetitionProposal({
    proposalId: 'proposal-1',
    status: 'accepted',
    title: 'ARSC Innovation Challenge',
    date: '2026-08-10',
    category: 'Internal ARSC',
    isActive: true,
    templateId: 'internal-arsc-template',
    rules: [{ label: 'Finalis', points: 6, sort_order: 10 }],
    tracks: [{ name: 'Poster Digital' }],
    trackName: 'Poster Digital',
    scoringRuleLabel: 'Finalis',
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual((globalThis as any).stage6ProposalRpc.fn, 'review_competition_proposal');
  assert.strictEqual((globalThis as any).stage6ProposalRpc.args.p_scoring_rule_label, 'Finalis');
  assert.deepStrictEqual((globalThis as any).stage6ProposalRpc.args.p_tracks, [{ name: 'Poster Digital' }]);
});
