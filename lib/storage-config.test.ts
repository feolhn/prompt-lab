import test from 'node:test'
import assert from 'node:assert/strict'

import { getRunStoreMode } from './storage-config.ts'

test('getRunStoreMode prefers kv rest credentials when available', () => {
  assert.equal(
    getRunStoreMode({
      KV_REST_API_URL: 'https://example.com',
      KV_REST_API_TOKEN: 'token',
      REDIS_URL: 'redis://example',
    }),
    'kv',
  )
})

test('getRunStoreMode falls back to redis url when kv rest credentials are absent', () => {
  assert.equal(
    getRunStoreMode({
      REDIS_URL: 'redis://example',
    }),
    'redis',
  )
})
