'use server'

import { randomUUID } from 'crypto'
import { parseOpenRouterImageBase64 } from '@/lib/openrouter'
import { getAllRuns, hashContent, saveRun, uploadImage } from '@/lib/storage'
import { PROMPT_TEXTS, type PromptVersion, type Run } from '@/lib/types'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL = 'openai/gpt-5.4-image-2'

type Attachment = {
  base64: string
  mimeType: string
  filename: string
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } }

function buildContentParts(prompt: string, attachment?: Attachment): ContentPart[] {
  const parts: ContentPart[] = [{ type: 'text', text: prompt }]
  if (!attachment) return parts

  if (attachment.mimeType === 'application/pdf') {
    parts.push({
      type: 'file',
      file: {
        filename: attachment.filename,
        file_data: `data:application/pdf;base64,${attachment.base64}`,
      },
    })
  } else {
    parts.push({
      type: 'image_url',
      image_url: { url: `data:${attachment.mimeType};base64,${attachment.base64}` },
    })
  }

  return parts
}

async function generateOpenRouterImage(
  prompt: string,
  attachment?: Attachment,
  imageSize: '1K' | '2K' = '1K',
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('未配置 OPENROUTER_API_KEY')
  }

  const content = attachment ? buildContentParts(prompt, attachment) : prompt

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: 'user', content }],
      modalities: ['image', 'text'],
      image_config: {
        aspect_ratio: '2:3',
        image_size: imageSize,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter 请求失败（${response.status}）：${errorText.slice(0, 200)}`)
  }

  const result = (await response.json()) as Parameters<typeof parseOpenRouterImageBase64>[0]
  return parseOpenRouterImageBase64(result)
}

export async function generateImage(
  content: string,
  promptVersion: PromptVersion,
  customPrompt?: string,
  stylePrompt?: string,
  attachment?: Attachment,
  imageSize: '1K' | '2K' = '1K',
): Promise<Run> {
  const basePrompt =
    promptVersion === 'custom' && customPrompt
      ? customPrompt
      : PROMPT_TEXTS[promptVersion as Exclude<PromptVersion, 'custom'>]

  const stylePart = stylePrompt?.trim()
    ? `\n\n视觉风格要求：\n${stylePrompt.trim()}`
    : ''

  const fullPrompt = `${basePrompt}\n\n${content}${stylePart}`
  const b64 = await generateOpenRouterImage(fullPrompt, attachment, imageSize)

  const id = randomUUID()
  const imageUrl = await uploadImage(b64, id)

  const effectiveContent = content.trim() || attachment?.filename || ''
  const run: Run = {
    id,
    contentHash: hashContent(effectiveContent),
    contentSnippet: (attachment && !content.trim()
      ? `[附件] ${attachment.filename}`
      : effectiveContent
    ).slice(0, 50).replace(/\s+/g, ' ').trim(),
    promptVersion,
    promptText: basePrompt,
    stylePrompt: stylePrompt?.trim() ?? '',
    imageUrl,
    createdAt: new Date().toISOString(),
  }

  await saveRun(run)
  return run
}

export async function getHistory(): Promise<Run[]> {
  return getAllRuns()
}
