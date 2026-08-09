import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

type QueryRecord = {
  table: string;
  columns: string;
  filters: Array<[string, unknown]>;
};

const queries: QueryRecord[] = [];
const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-service-key';
process.env.RAPOR_ACCESS_CODE_PEPPER = 'test-pepper';

const rows: Record<string, Record<string, unknown>> = {
  rapor_access_codes: {
    member_code: 'RTP_2026_048',
    release_code: 'RTP_2026',
  },
  rapor_members: {
    member_code: 'RTP_2026_048',
    release_code: 'RTP_2026',
    name: 'Legacy Member',
    unit: 'RISTEK',
    jabatan: 'Anggota Muda',
  },
};

const integrationClient = {
  from(table: string) {
    let columns = '';
    const filters: Array<[string, unknown]> = [];
    const builder = {
      select(value: string) {
        columns = value;
        return builder;
      },
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return builder;
      },
      async maybeSingle() {
        queries.push({ table, columns, filters: [...filters] });
        return { data: rows[table] ?? null, error: null };
      },
    };
    return builder;
  },
  async rpc(name: string, args: Record<string, unknown>) {
    rpcCalls.push({ name, args });
    return {
      data: {
        profile_id: 'profile-1',
        member_id: 'member-1',
        full_name: 'Legacy Member',
        bidang_biro: 'Bidang Riset dan Teknologi (RISTEK)',
        link_status: 'linked_exact',
      },
      error: null,
    };
  },
};

mock.module('next/cache', {
  namedExports: { revalidatePath: () => undefined },
});

mock.module('@supabase/supabase-js', {
  namedExports: { createClient: () => integrationClient },
});

mock.module('@/lib/supabase/server', {
  namedExports: {
    createClient: async () => ({
      auth: {
        getUser: async () => ({
          data: { user: { id: 'auth-user-1' } },
          error: null,
        }),
      },
    }),
  },
});

const { linkProfileWithRaporCode } = await import('../../src/lib/actions/raporIdentity.ts');

test('legacy Rapor codes resolve their stored member release without requiring the active release', async () => {
  const result = await linkProfileWithRaporCode('legacy-code');

  assert.equal(result.success, true);
  const memberQuery = queries.find((query) => query.table === 'rapor_members');
  assert.ok(memberQuery);
  assert.deepEqual(memberQuery.filters, [
    ['member_code', 'RTP_2026_048'],
    ['release_code', 'RTP_2026'],
  ]);
  assert.doesNotMatch(memberQuery.columns, /rapor_releases/);
  assert.equal(rpcCalls[0]?.name, 'link_arsc_account_from_reference');
  assert.equal(rpcCalls[0]?.args.p_release_code, 'RTP_2026');
});
