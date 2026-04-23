import test from 'node:test'
import assert from 'node:assert/strict'

import { parseOpenRouterImageBase64 } from './openrouter.ts'

test('parseOpenRouterImageBase64 supports message.images data URLs', () => {
  const base64 = parseOpenRouterImageBase64({
    choices: [
      {
        message: {
          images: [
            {
              image_url: {
                url: 'data:image/png;base64,abc123',
              },
            },
          ],
        },
      },
    ],
  })

  assert.equal(base64, 'abc123')
})

test('parseOpenRouterImageBase64 supports content-array image payloads', () => {
  const base64 = parseOpenRouterImageBase64({
    choices: [
      {
        message: {
          content: [
            {
              type: 'output_text',
              text: 'done',
            },
            {
              type: 'output_image',
              image_url: {
                url: 'data:image/png;base64,xyz789',
              },
            },
          ],
        },
      },
    ],
  })

  assert.equal(base64, 'xyz789')
})

test('parseOpenRouterImageBase64 falls back to b64_json payloads', () => {
  const base64 = parseOpenRouterImageBase64({
    choices: [
      {
        message: {
          images: [
            {
              b64_json: 'b64payload',
            },
          ],
        },
      },
    ],
  })

  assert.equal(base64, 'b64payload')
})
