import test from 'node:test'
import assert from 'node:assert/strict'

import { extractHtmlText, isHttpUrl, normalizeUrlInput } from './url-content.ts'

test('isHttpUrl only accepts a single http or https URL', () => {
  assert.equal(isHttpUrl('https://example.com/article'), true)
  assert.equal(isHttpUrl('  http://example.com/article  '), true)
  assert.equal(isHttpUrl('ftp://example.com/article'), false)
  assert.equal(isHttpUrl('read this https://example.com/article'), false)
})

test('normalizeUrlInput strips tracking fragments but preserves the origin and path', () => {
  assert.equal(
    normalizeUrlInput(' https://example.com/path?a=1#section '),
    'https://example.com/path?a=1',
  )
})

test('extractHtmlText removes scripts and keeps readable article text', () => {
  const text = extractHtmlText(`
    <html><head><style>.x{}</style><script>alert(1)</script></head>
    <body><article><h1>Title</h1><p>Hello &amp; welcome.</p></article></body></html>
  `)

  assert.match(text, /Title/)
  assert.match(text, /Hello & welcome\./)
  assert.doesNotMatch(text, /alert/)
})
