import test from 'node:test'
import assert from 'node:assert/strict'

import { buildKimiRequestBody, KIMI_MODEL, buildWebSearchNudgeMessage } from './kimi.ts'

test('buildKimiRequestBody uses current Kimi K2.6 model and disables thinking for JSON output', () => {
  const body = buildKimiRequestBody([{ role: 'user', content: 'hello' }])

  assert.equal(KIMI_MODEL, 'kimi-k2.6')
  assert.equal(body.model, 'kimi-k2.6')
  assert.deepEqual(body.thinking, { type: 'disabled' })
  assert.deepEqual(body.response_format, { type: 'json_object' })
  assert.deepEqual(body.messages.at(-1), { role: 'user', content: 'hello' })
})

test('buildKimiRequestBody can enable Kimi built-in web search', () => {
  const body = buildKimiRequestBody([{ role: 'user', content: 'read this URL' }], {
    allowWebSearch: true,
  })

  assert.equal(body.response_format, undefined)
  assert.deepEqual(body.tools, [
    {
      type: 'builtin_function',
      function: { name: '$web_search' },
    },
  ])
})

test('buildWebSearchNudgeMessage fails fast instead of allowing URL guessing', () => {
  assert.deepEqual(buildWebSearchNudgeMessage(), {
    role: 'user',
    content: '当前任务必须先选择并调用 $web_search 工具读取 URL 真实内容。不要直接回答，不要猜测页面内容。',
  })
})
