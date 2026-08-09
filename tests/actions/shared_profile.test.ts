import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { accountUsesRapor, formatHaloPosition, formatHaloUnit } from '../../src/lib/sharedProfile.ts';

type ProfileWrite = {
  table: string;
  values: { avatar_url: string | null };
  column: string;
  value: string;
};

const writes: ProfileWrite[] = [];

mock.module('next/cache', {
  namedExports: {
    revalidatePath: () => undefined,
  },
});

mock.module('@supabase/supabase-js', {
  namedExports: {
    createClient: () => ({
      from: () => ({
        select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
      rpc: async () => ({ data: null, error: null }),
    }),
  },
});

mock.module('@/lib/supabase/server', {
  namedExports: {
    createClient: async () => ({
      auth: {
        getUser: async () => ({
          data: { user: { id: 'ph-user' } },
          error: null,
        }),
      },
      from: (table: string) => ({
        update: (values: { avatar_url: string | null }) => ({
          eq: async (column: string, value: string) => {
            writes.push({ table, values, column, value });
            return { error: null };
          },
        }),
      }),
    }),
  },
});

const { updateProfileAvatar } = await import('../../src/lib/actions/raporIdentity.ts');

test('shared account profile rules', async (t) => {
  await t.test('uses Halo labels and exempts PH accounts from the Rapor link flow', () => {
    assert.equal(formatHaloUnit('psdm'), 'Biro Pengembangan Sumber Daya Mahasiswa (PSDM)');
    assert.equal(formatHaloPosition('PENGURUS_HARIAN'), 'Pengurus Harian');
    assert.equal(accountUsesRapor('PH'), false);
    assert.equal(accountUsesRapor('MEMBER'), true);
  });

  await t.test('updates the signed-in user avatar in Halo and the optional Leaderboard projection', async () => {
    writes.length = 0;

    const result = await updateProfileAvatar(' https://example.com/avatar.webp ');

    assert.deepEqual(result, { success: true });
    assert.deepEqual(writes, [
      {
        table: 'users',
        values: { avatar_url: 'https://example.com/avatar.webp' },
        column: 'id',
        value: 'ph-user',
      },
      {
        table: 'profiles',
        values: { avatar_url: 'https://example.com/avatar.webp' },
        column: 'user_id',
        value: 'ph-user',
      },
    ]);
  });

  await t.test('rejects a non-HTTPS avatar before writing either profile', async () => {
    writes.length = 0;

    const result = await updateProfileAvatar('http://example.com/avatar.webp');

    assert.equal(result.success, false);
    assert.equal(writes.length, 0);
  });
});
