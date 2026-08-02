import test from 'node:test';
import assert from 'node:assert/strict';
import { hashRaporAccessCode, normalizeRaporUnit } from '../../src/lib/rapor/identity.ts';

test('Rapor identity helpers follow the producer contract', async (t) => {
  await t.test('normalizes access codes exactly like the Rapor portal', () => {
    const hash = hashRaporAccessCode('  ARSC-Member-001  ', 'test-pepper');
    assert.equal(hash, '49d0e0003394813ad0ee18c5ea7e4ba81198d2deda2807080742ef152b96dd6c');
  });

  await t.test('maps Rapor unit codes to constrained Leaderboard labels', () => {
    assert.equal(normalizeRaporUnit('ristek'), 'Bidang Riset dan Teknologi (RISTEK)');
    assert.equal(normalizeRaporUnit(' KETUA UMUM '), 'Ketua Umum (KETUM)');
    assert.equal(normalizeRaporUnit('UNKNOWN'), null);
  });
});
