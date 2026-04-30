import fs from 'fs'
import path from 'path'
import type { ConversationMessage, MaterialUnderstandingProvider, ProviderAttachment, ProviderInput, ProviderOutput } from './types'
import { parseProviderJsonOutput } from './prompt-output.js'

const POE_CHAT_COMPLETIONS_URL = 'https://api.poe.com/v1/chat/completions'
const POE_BOT_BASE_URL = 'https://api.poe.com/bot'
const POE_FILE_UPLOAD_URL = 'https://www.quora.com/poe_api/file_upload_3RD_PARTY_POST'
export const DEFAULT_POE_GEMINI_MODEL = 'Gemini-3.1-Flash-Lite'

type PoeChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }
type PoeProtocolAttachment = { url: string; content_type: string; name: string }
type PoeProtocolMessage = {
  role: 'system' | 'user' | 'bot'
  content: string
  content_type?: 'text/markdown'
  attachments?: PoeProtocolAttachment[]
}

function loadSkillPrompt(): string {
  const skillPath = path.join(process.cwd(), 'lib', 'providers', 'skill-prompt.md')
  if (fs.existsSync(skillPath)) return fs.readFileSync(skillPath, 'utf-8')
  return ''
}

const SYSTEM_PROMPT = `${loadSkillPrompt()}

你是一位专业的视觉信息设计专家。用户会向你提供需要可视化的内容（文章、数据、报告、图片等），你需要：
1. 理解内容的核心价值与信息结构
2. 按照 visual-info-prompting skill 的规范，规划并生成专业的英文图片生成 prompt
3. 同时提供简洁的中文摘要供用户确认

如果用户提供 URL 或要求读取网页，必须基于真实可访问内容；当前 Poe Gemini 请求会在用户消息里提供 --web_search true。

必须以如下 JSON schema 返回，不要输出任何其他内容，不要 markdown fence：
{
  "assistantSummaryCn": "面向用户的中文说明，描述将生成什么样的可视化，2-3句话",
  "imagePromptEn": "完整的英文图片生成 prompt，符合 visual-info-prompting 规范",
  "artifactSpec": "内部 artifact 规格，JSON 字符串",
  "canvas": "1024x1536、1536x1024 或 1024x1024",
  "qualityHint": "low、medium 或 high",
  "inputSummaryCn": "用户输入内容的简短中文摘要，不超过30字，用于历史记录展示",
  "warnings": []
}`

function getPoeGeminiModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.POE_GEMINI_MODEL || DEFAULT_POE_GEMINI_MODEL
}

function requiresWebSearch(text: string): boolean {
  return /https?:\/\/\S+/i.test(text)
}

function withWebSearchHint(text: string): string {
  if (!requiresWebSearch(text) || text.includes('--web_search true')) return text
  return `${text}\n\n--web_search true`
}

function buildDraftChatMessages(input: ProviderInput): PoeChatMessage[] {
  const text = input.text?.trim() || '请基于用户提供的附件内容生成信息图 Prompt。'
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: withWebSearchHint(text) },
  ]
}

function buildReviseChatMessages(input: ProviderInput): PoeChatMessage[] {
  const messages: PoeChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }]
  for (const msg of input.conversation ?? []) {
    const content = msg.content.trim()
    if (!content) continue
    messages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.role === 'user' ? withWebSearchHint(content) : content,
    })
  }
  if (messages.length === 1) throw new Error('修改意见为空，请输入需要调整的内容')
  return messages
}

async function callPoeChatCompletions(messages: PoeChatMessage[]): Promise<{ text: string; durationMs: number }> {
  const apiKey = process.env.POE_API_KEY
  if (!apiKey) throw new Error('未配置 POE_API_KEY')

  const model = getPoeGeminiModel()
  const startedAt = Date.now()
  const res = await fetch(POE_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: 'json_object' },
      stream: false,
    }),
  })

  const durationMs = Date.now() - startedAt
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Poe Gemini API 错误（${res.status}）：${body.slice(0, 300)}`)
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: unknown }
  console.log('[Poe Gemini] ← chat durationMs:', durationMs, '| usage:', JSON.stringify(data.usage))
  return { text: data.choices?.[0]?.message?.content ?? '', durationMs }
}

async function uploadPoeAttachment(attachment: ProviderAttachment): Promise<PoeProtocolAttachment> {
  const apiKey = process.env.POE_API_KEY
  if (!apiKey) throw new Error('未配置 POE_API_KEY')

  const startedAt = Date.now()
  const form = new URLSearchParams()
  form.set('download_url', attachment.blobUrl)
  form.set('download_filename', attachment.filename)

  const res = await fetch(POE_FILE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Poe 附件上传失败（${res.status}）：${body.slice(0, 300)}`)
  }

  const data = await res.json() as { attachment_url?: string; mime_type?: string }
  if (!data.attachment_url || !data.mime_type) {
    throw new Error(`Poe 附件上传返回结构异常：${JSON.stringify(data).slice(0, 300)}`)
  }

  console.log('[Poe Gemini] ← attachment upload:', attachment.filename, '| durationMs:', Date.now() - startedAt)
  return {
    url: data.attachment_url,
    content_type: data.mime_type || attachment.mimeType,
    name: attachment.filename,
  }
}

function toProtocolRole(role: ConversationMessage['role']): PoeProtocolMessage['role'] {
  return role === 'assistant' ? 'bot' : 'user'
}

async function buildProtocolMessages(input: ProviderInput, isRevise: boolean): Promise<PoeProtocolMessage[]> {
  if (isRevise) {
    const messages: PoeProtocolMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }]
    for (const msg of input.conversation ?? []) {
      const content = msg.content.trim()
      if (!content) continue
      messages.push({
        role: toProtocolRole(msg.role),
        content: msg.role === 'user' ? withWebSearchHint(content) : content,
        content_type: 'text/markdown',
      })
    }
    if (messages.length === 1) throw new Error('修改意见为空，请输入需要调整的内容')
    return messages
  }

  const attachments = await Promise.all((input.attachments ?? []).map(uploadPoeAttachment))
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: withWebSearchHint(input.text?.trim() || '请基于附件内容生成信息图 Prompt，并只返回 JSON。'),
      content_type: 'text/markdown',
      attachments,
    },
  ]
}

async function callPoeBot(messages: PoeProtocolMessage[]): Promise<{ text: string; durationMs: number }> {
  const apiKey = process.env.POE_API_KEY
  if (!apiKey) throw new Error('未配置 POE_API_KEY')

  const model = getPoeGeminiModel()
  const startedAt = Date.now()
  const res = await fetch(`${POE_BOT_BASE_URL}/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: '1.2',
      type: 'query',
      query: messages,
      user_id: '',
      conversation_id: '',
      message_id: '',
    }),
  })

  if (!res.ok || !res.body) {
    const body = await res.text()
    throw new Error(`Poe Gemini Bot API 错误（${res.status}）：${body.slice(0, 300)}`)
  }

  const text = await readPoeSseText(res.body)
  const durationMs = Date.now() - startedAt
  console.log('[Poe Gemini] ← bot durationMs:', durationMs)
  return { text, durationMs }
}

async function readPoeSseText(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let output = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    buffer = buffer.replace(/\r\n/g, '\n')

    let boundary = buffer.indexOf('\n\n')
    while (boundary >= 0) {
      const rawEvent = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      output += parseSseEventText(rawEvent)
      boundary = buffer.indexOf('\n\n')
    }
  }

  if (buffer.trim()) output += parseSseEventText(buffer)
  return output.trim()
}

function parseSseEventText(rawEvent: string): string {
  const event = rawEvent.match(/^event:\s*(.+)$/m)?.[1]?.trim()
  const data = rawEvent
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')

  if (event === 'text' || event === 'replace_response') {
    try {
      const parsed = JSON.parse(data) as { text?: string; replace_response?: string }
      return parsed.text ?? parsed.replace_response ?? ''
    } catch {
      return ''
    }
  }

  if (event === 'error') throw new Error(`Poe Gemini Bot 返回错误：${data.slice(0, 300)}`)
  return ''
}

export const poeGeminiProvider: MaterialUnderstandingProvider = {
  async draft(input: ProviderInput): Promise<ProviderOutput> {
    const hasAttachments = Boolean(input.attachments?.length)
    const { text, durationMs } = hasAttachments
      ? await callPoeBot(await buildProtocolMessages(input, false))
      : await callPoeChatCompletions(buildDraftChatMessages(input))
    return parseProviderJsonOutput(text, getPoeGeminiModel(), durationMs)
  },

  async revise(input: ProviderInput): Promise<ProviderOutput> {
    const { text, durationMs } = await callPoeChatCompletions(buildReviseChatMessages(input))
    return parseProviderJsonOutput(text, getPoeGeminiModel(), durationMs)
  },
}
