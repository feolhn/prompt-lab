import fs from 'fs'
import path from 'path'
import type {
  ImageCanvas,
  ImageQuality,
  MaterialUnderstandingProvider,
  ProviderInput,
  ProviderOutput,
} from './types'

const MOONSHOT_API_BASE = 'https://api.moonshot.cn/v1'
export const KIMI_MODEL = 'kimi-k2.6'
const KIMI_CANVAS_OPTIONS: readonly ImageCanvas[] = ['1024x1536', '1536x1024', '1024x1024']
const KIMI_QUALITY_OPTIONS: readonly ImageQuality[] = ['low', 'medium', 'high']

function loadSkillPrompt(): string {
  const skillPath = path.join(process.cwd(), 'lib', 'providers', 'skill-prompt.md')
  if (fs.existsSync(skillPath)) {
    return fs.readFileSync(skillPath, 'utf-8')
  }
  return ''
}

const SKILL_PROMPT = loadSkillPrompt()
console.log('[Kimi] skill prompt loaded, length:', SKILL_PROMPT.length)

const SYSTEM_PROMPT = `${SKILL_PROMPT}

你是一位专业的视觉信息设计专家。用户会向你提供需要可视化的内容（文章、数据、报告、图片等），你需要：
1. 理解内容的核心价值与信息结构
2. 按照 visual-info-prompting skill 的规范，规划并生成专业的英文图片生成 prompt
3. 同时提供简洁的中文摘要供用户确认

如果用户要求读取 URL 或联网搜索，并且当前请求提供了 $web_search 工具，你必须先调用 $web_search 获取真实内容。
tool_calls 不是最终输出；完成联网搜索后，最终回复仍必须是下面的 JSON schema。

必须以如下 JSON schema 返回，不要输出任何其他内容：
{
  "assistantSummaryCn": "面向用户的中文说明，描述将生成什么样的可视化，2-3句话",
  "imagePromptEn": "完整的英文图片生成 prompt，符合 visual-info-prompting 规范",
  "artifactSpec": "内部 artifact 规格，JSON 字符串",
  "canvas": "1024x1536、1536x1024 或 1024x1024",
  "qualityHint": "low、medium 或 high",
  "inputSummaryCn": "用户输入内容的简短中文摘要，不超过30字，用于历史记录展示",
  "warnings": []
}`

type KimiMessage = { role: string; content: unknown; [key: string]: unknown }
type KimiRequestBody = {
  model: string
  messages: KimiMessage[]
  response_format?: { type: 'json_object' }
  thinking: { type: 'disabled' }
  tools?: Array<{ type: 'builtin_function'; function: { name: '$web_search' } }>
}

function buildMessages(input: ProviderInput, isRevise: boolean) {
  const messages: KimiMessage[] = []

  if (isRevise && input.conversation && input.conversation.length > 0) {
    for (const msg of input.conversation) {
      messages.push({ role: msg.role, content: msg.content })
    }
  } else {
    const contentParts: Array<{ type: string; [key: string]: unknown }> = []

    if (input.text?.trim()) {
      contentParts.push({ type: 'text', text: input.text.trim() })
    }

    if (input.attachments && input.attachments.length > 0) {
      for (const att of input.attachments) {
        if (att.mimeType === 'application/pdf') {
          contentParts.push({
            type: 'file',
            file: { url: att.blobUrl, filename: att.filename },
          })
        } else if (att.mimeType.startsWith('image/')) {
          contentParts.push({
            type: 'image_url',
            image_url: { url: att.dataUrl ?? att.blobUrl, detail: 'high' },
          })
        }
      }
    }

    messages.push({
      role: 'user',
      content: contentParts.length === 1 && contentParts[0].type === 'text'
        ? contentParts[0].text
        : contentParts,
    })
  }

  return messages
}

async function callKimi(
  messages: KimiMessage[],
  options: { allowWebSearch?: boolean } = {},
): Promise<{ text: string; durationMs: number }> {
  const apiKey = process.env.MOONSHOT_API_KEY
  if (!apiKey) throw new Error('未配置 MOONSHOT_API_KEY')

  console.log('[Kimi] → request model:', KIMI_MODEL)
  console.log('[Kimi] → last user message preview:', JSON.stringify(messages[messages.length - 1]).slice(0, 300))

  const start = Date.now()
  const workingMessages = [...messages]
  let webSearchNudged = false
  let webSearchCalled = false

  for (let i = 0; i < 4; i += 1) {
    const requestBody = buildKimiRequestBody(workingMessages, options)
    console.log('[Kimi] → messages count:', requestBody.messages.length)
    console.log('[Kimi] → system prompt length:', SYSTEM_PROMPT.length)

    const res = await fetch(`${MOONSHOT_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    const durationMs = Date.now() - start
    console.log('[Kimi] ← status:', res.status, '| durationMs:', durationMs)

    if (!res.ok) {
      const err = await res.text()
      console.error('[Kimi] ← error body:', err.slice(0, 500))
      throw new Error(`Kimi API 错误（${res.status}）：${err.slice(0, 200)}`)
    }

    const data = await res.json() as {
      choices: Array<{
        finish_reason?: string
        message: { content?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }
      }>
      usage?: { prompt_tokens: number; completion_tokens: number }
    }
    const choice = data.choices?.[0]
    const message = choice?.message
    console.log('[Kimi] ← tokens:', JSON.stringify(data.usage))

    if (choice?.finish_reason === 'tool_calls' && message?.tool_calls?.length) {
      webSearchCalled = true
      workingMessages.push({ role: 'assistant', content: message.content ?? '', tool_calls: message.tool_calls })

      for (const toolCall of message.tool_calls) {
        workingMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: toolCall.function.arguments,
        })
      }
      continue
    }

    const text = message?.content ?? ''
    if (options.allowWebSearch && !webSearchCalled) {
      if (webSearchNudged) {
        throw new Error('Kimi 未调用 $web_search，URL 内容无法验证')
      }

      workingMessages.push({ role: 'assistant', content: text })
      workingMessages.push(buildWebSearchNudgeMessage())
      webSearchNudged = true
      continue
    }

    console.log('[Kimi] ← response preview:', text.slice(0, 500))
    return { text, durationMs }
  }

  throw new Error('Kimi 联网搜索工具调用超过最大轮次')
}

export function buildWebSearchNudgeMessage(): KimiMessage {
  return {
    role: 'user',
    content: '当前任务必须先选择并调用 $web_search 工具读取 URL 真实内容。不要直接回答，不要猜测页面内容。',
  }
}

export function buildKimiRequestBody(
  messages: KimiMessage[],
  options: { allowWebSearch?: boolean } = {},
): KimiRequestBody {
  const body: KimiRequestBody = {
    model: KIMI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ],
    thinking: { type: 'disabled' },
  }

  if (options.allowWebSearch) {
    body.tools = [
      {
        type: 'builtin_function',
        function: { name: '$web_search' },
      },
    ]
  } else {
    body.response_format = { type: 'json_object' }
  }

  return body
}

function parseOutput(text: string, durationMs: number): ProviderOutput {
  let parsed: Partial<ProviderOutput>
  try {
    parsed = JSON.parse(text) as Partial<ProviderOutput>
  } catch {
    throw new Error(`Kimi 返回的 JSON 无法解析：${text.slice(0, 300)}`)
  }

  if (!parsed.imagePromptEn || !parsed.assistantSummaryCn) {
    throw new Error(`Kimi 返回结构不完整：${text.slice(0, 300)}`)
  }

  const canvas = KIMI_CANVAS_OPTIONS.includes(parsed.canvas as ImageCanvas)
    ? parsed.canvas as ImageCanvas
    : '1024x1536'
  const qualityHint = KIMI_QUALITY_OPTIONS.includes(parsed.qualityHint as ImageQuality)
    ? parsed.qualityHint as ImageQuality
    : 'low'

  return {
    assistantSummaryCn: parsed.assistantSummaryCn,
    imagePromptEn: parsed.imagePromptEn,
    artifactSpec: parsed.artifactSpec ?? '',
    canvas,
    qualityHint,
    inputSummaryCn: parsed.inputSummaryCn ?? '',
    warnings: parsed.warnings ?? [],
    providerDiagnostics: {
      model: KIMI_MODEL,
      durationMs,
    },
  }
}

export const kimiProvider: MaterialUnderstandingProvider = {
  async draft(input: ProviderInput): Promise<ProviderOutput> {
    const messages = buildMessages(input, false)
    const { text, durationMs } = await callKimi(messages, { allowWebSearch: input.allowWebSearch })
    return parseOutput(text, durationMs)
  },

  async revise(input: ProviderInput): Promise<ProviderOutput> {
    const messages = buildMessages(input, true)
    const { text, durationMs } = await callKimi(messages, { allowWebSearch: input.allowWebSearch })
    return parseOutput(text, durationMs)
  },
}
