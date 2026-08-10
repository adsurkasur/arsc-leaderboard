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
      auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
      rpc: async (fn: string, args: unknown) => {
        (globalThis as any).stage7RpcCalls.push({ fn, args });
        return { data: { success: true }, error: null };
      },
    }),
  },
});

const { addCaseMessage, deleteCompetition, markAllNotificationsRead, markNotificationRead } = await import(
  '../../src/lib/actions/stage7_operations'
);

test('Stage 7 actions only use guarded RPC contracts', async (t) => {
  t.beforeEach(() => {
    (globalThis as any).stage7RpcCalls = [];
  });

  await t.test('adds an admin-visible case message through the RPC', async () => {
    const result = await addCaseMessage({
      caseType: 'proposal',
      caseId: 'proposal-1',
      body: 'Mohon cek kategori.',
      visibility: 'admins_only',
    });

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual((globalThis as any).stage7RpcCalls[0], {
      fn: 'leaderboard_add_case_message',
      args: {
        p_case_type: 'proposal',
        p_case_id: 'proposal-1',
        p_body: 'Mohon cek kategori.',
        p_visibility: 'admins_only',
      },
    });
  });

  await t.test('marks individual and all notifications through RPCs', async () => {
    await markNotificationRead('notification-1');
    await markAllNotificationsRead();

    assert.deepStrictEqual((globalThis as any).stage7RpcCalls.map((call: { fn: string }) => call.fn), [
      'leaderboard_mark_notification_read',
      'leaderboard_mark_all_notifications_read',
    ]);
  });

  await t.test('passes exact title confirmation to guarded deletion', async () => {
    await deleteCompetition('competition-1', 'Kompetisi Kosong');
    assert.deepStrictEqual((globalThis as any).stage7RpcCalls[0], {
      fn: 'leaderboard_delete_competition',
      args: {
        p_competition_id: 'competition-1',
        p_confirmation_title: 'Kompetisi Kosong',
      },
    });
  });
});
