import test from 'node:test'
import assert from 'node:assert/strict'

import { prepareProviderAttachments } from './provider-attachments.ts'

test('prepareProviderAttachments converts image blob URLs to data URLs', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })

  try {
    const input = await prepareProviderAttachments({
      attachments: [
        {
          blobUrl: 'https://example.com/image.jpg',
          mimeType: 'image/jpeg',
          filename: 'image.jpg',
        },
      ],
    })

    assert.equal(input.attachments?.[0].dataUrl, 'data:image/jpeg;base64,AQID')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('prepareProviderAttachments leaves unsupported non-image attachments unchanged', async () => {
  const input = await prepareProviderAttachments({
    attachments: [
      {
        blobUrl: 'https://example.com/file.txt',
        mimeType: 'text/plain',
        filename: 'file.txt',
      },
    ],
  })

  assert.equal(input.attachments?.[0].dataUrl, undefined)
})

test('prepareProviderAttachments extracts PDF attachments through Kimi files API', async () => {
  const originalFetch = globalThis.fetch
  const originalApiKey = process.env.MOONSHOT_API_KEY
  process.env.MOONSHOT_API_KEY = 'test-key'
  const calls: Array<{ url: string; init?: RequestInit }> = []

  globalThis.fetch = async (input, init) => {
    const url = input instanceof URL ? input.toString() : String(input)
    calls.push({ url, init })

    if (url === 'https://example.com/file.pdf') {
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 })
    }

    if (url === 'https://api.moonshot.cn/v1/files') {
      assert.equal(init?.method, 'POST')
      assert.equal((init?.headers as Record<string, string>)?.Authorization, 'Bearer test-key')
      assert.ok(init?.body instanceof FormData)
      return Response.json({ id: 'file-123' })
    }

    if (url === 'https://api.moonshot.cn/v1/files/file-123/content') {
      return new Response('PDF extracted text', { status: 200 })
    }

    return new Response('unexpected request', { status: 500 })
  }

  try {
    const input = await prepareProviderAttachments({
      attachments: [
        {
          blobUrl: 'https://example.com/file.pdf',
          mimeType: 'application/pdf',
          filename: 'file.pdf',
        },
      ],
    })

    assert.equal(input.attachments?.[0].extractedText, 'PDF extracted text')
    assert.equal(calls.length, 3)
  } finally {
    globalThis.fetch = originalFetch
    if (originalApiKey === undefined) {
      delete process.env.MOONSHOT_API_KEY
    } else {
      process.env.MOONSHOT_API_KEY = originalApiKey
    }
  }
})
