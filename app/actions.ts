'use server'

import { randomUUID } from 'crypto'
import { parseOpenRouterImageBase64 } from '@/lib/openrouter'
import { getAllRuns, hashContent, saveRun, uploadImage } from '@/lib/storage'
import { PROMPT_TEXTS, type PromptVersion, type Run } from '@/lib/types'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL = 'openai/gpt-5.4-image-2'

async function generateOpenRouterImage(prompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('未配置 OPENROUTER_API_KEY')
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image', 'text'],
      image_config: {
        aspect_ratio: '2:3',
        image_size: '1K',
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
): Promise<Run> {
  const basePrompt =
    promptVersion === 'custom' && customPrompt
      ? customPrompt
      : PROMPT_TEXTS[promptVersion as Exclude<PromptVersion, 'custom'>]

  const stylePart = stylePrompt?.trim()
    ? `\n\n视觉风格要求：\n${stylePrompt.trim()}`
    : ''

  const fullPrompt = `${basePrompt}\n\n${content}${stylePart}`
  const b64 = await generateOpenRouterImage(fullPrompt)

  const id = randomUUID()
  const imageUrl = await uploadImage(b64, id)

  const run: Run = {
    id,
    contentHash: hashContent(content),
    contentSnippet: content.slice(0, 50).replace(/\s+/g, ' ').trim(),
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
