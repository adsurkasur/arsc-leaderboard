import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OperationTimeoutError, withTimeout } from '../../src/lib/async';

test('withTimeout returns a completed operation unchanged', async () => {
  const result = await withTimeout(Promise.resolve('ready'), 50);
  assert.equal(result, 'ready');
});

test('withTimeout releases the UI when an operation never settles', async () => {
  const pending = new Promise<string>(() => undefined);

  await assert.rejects(
    withTimeout(pending, 5, 'request timed out'),
    (error: unknown) => error instanceof OperationTimeoutError
      && error.message === 'request timed out',
  );
});
