import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildPoeImageRequest,
  DEFAULT_POE_IMAGE_MODEL,
  extractPoeImageUrl,
  getPoeImageModel,
} from './poe-image.ts'

test('buildPoeImageRequest uses Poe chat completions image shape', () => {
  assert.deepEqual(
    buildPoeImageRequest('make an infographic', 'gpt-image-2'),
    {
      model: 'gpt-image-2',
      messages: [{ role: 'user', content: 'make an infographic' }],
      size: '1024x1536',
      quality: 'low',
      stream: false,
    },
  )
})

test('buildPoeImageRequest passes size and quality as Poe request fields', () => {
  assert.deepEqual(
    buildPoeImageRequest('make an infographic', 'gpt-image-2', '1536x1024', 'high'),
    {
      model: 'gpt-image-2',
      messages: [{ role: 'user', content: 'make an infographic' }],
      size: '1536x1024',
      quality: 'high',
      stream: false,
    },
  )
})

test('getPoeImageModel defaults to gpt-image-2', () => {
  assert.equal(getPoeImageModel({}), DEFAULT_POE_IMAGE_MODEL)
  assert.equal(getPoeImageModel({ POE_IMAGE_MODEL: 'custom-image-model' }), 'custom-image-model')
})

test('extractPoeImageUrl supports markdown and plain URL responses', () => {
  assert.equal(
    extractPoeImageUrl('done\n![image](https://pfst.cf2.poecdn.net/image.png)'),
    'https://pfst.cf2.poecdn.net/image.png',
  )
  assert.equal(
    extractPoeImageUrl('image: https://pfst.cf2.poecdn.net/image.png.'),
    'https://pfst.cf2.poecdn.net/image.png',
  )
})
