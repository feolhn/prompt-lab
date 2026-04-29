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

test('prepareProviderAttachments leaves non-image attachments unchanged', async () => {
  const input = await prepareProviderAttachments({
    attachments: [
      {
        blobUrl: 'https://example.com/file.pdf',
        mimeType: 'application/pdf',
        filename: 'file.pdf',
      },
    ],
  })

  assert.equal(input.attachments?.[0].dataUrl, undefined)
})
