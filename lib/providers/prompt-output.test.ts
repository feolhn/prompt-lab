import test from 'node:test'
import assert from 'node:assert/strict'

import { extractJsonText, parseProviderJsonOutput } from './prompt-output.js'

test('extractJsonText unwraps markdown fenced JSON returned by Poe Gemini', () => {
  assert.equal(extractJsonText('```json\n{"ok":true}\n```'), '{"ok":true}')
})

test('parseProviderJsonOutput normalizes provider output defaults', () => {
  const output = parseProviderJsonOutput(JSON.stringify({
    assistantSummaryCn: '摘要',
    imagePromptEn: 'Artifact type: infographic',
    artifactSpec: { type: 'infographic' },
    canvas: 'bad-size',
    qualityHint: 'bad-quality',
    inputSummaryCn: '输入',
  }), 'test-model', 12)

  assert.equal(output.canvas, '1024x1536')
  assert.equal(output.qualityHint, 'low')
  assert.equal(output.providerDiagnostics.model, 'test-model')
  assert.equal(output.providerDiagnostics.durationMs, 12)
  assert.equal(output.artifactSpec, '{"type":"infographic"}')
})
