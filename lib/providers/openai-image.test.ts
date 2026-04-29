import test from 'node:test'
import assert from 'node:assert/strict'

import { buildOpenAIImageRequest } from './openai-image.ts'

test('buildOpenAIImageRequest uses GPT Image 2 compatible output format', () => {
  assert.deepEqual(
    buildOpenAIImageRequest('make an infographic', '1024x1536', 'medium'),
    {
      model: 'gpt-image-2',
      prompt: 'make an infographic',
      size: '1024x1536',
      quality: 'medium',
      output_format: 'png',
      n: 1,
    },
  )
})
