// Part of npm run test:unit (tsx --test)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeBasePath, withBase } from '../../src/lib/base-path'

test('empty base path keeps root-relative URLs unchanged (standalone production)', () => {
  assert.equal(normalizeBasePath(undefined), '')
  assert.equal(normalizeBasePath(''), '')
  assert.equal(withBase('/api/x', ''), '/api/x')
})

test('zone base path prefixes root-relative URLs only', () => {
  const base = normalizeBasePath('/app/leaderboard/')
  assert.equal(base, '/app/leaderboard')
  assert.equal(withBase('/api/x?id=1', base), '/app/leaderboard/api/x?id=1')
  assert.equal(withBase('/arsc-logo.png', base), '/app/leaderboard/arsc-logo.png')
  assert.equal(withBase('https://cdn.example/qris.png', base), 'https://cdn.example/qris.png')
  assert.equal(withBase('//cdn.example/x.png', base), '//cdn.example/x.png')
})

test('invalid base paths fail fast', () => {
  assert.throws(() => normalizeBasePath('app/printing'))
  assert.throws(() => normalizeBasePath('/app printing'))
})
