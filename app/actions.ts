'use server'

import OpenAI from 'openai'
import { randomUUID } from 'crypto'
import { getAllRuns, hashContent, saveRun, uploadImage } from '@/lib/storage'
import { PROMPT_TEXTS, type PromptVersion, type Run } from '@/lib/types'

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
})

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

  const response = await openai.images.generate({
    model: 'openai/gpt-5.4-image-2' as string,
    prompt: fullPrompt,
    size: '1024x1536',
    n: 1,
    response_format: 'b64_json',
  })

  const b64 = response.data?.[0]?.b64_json
  if (!b64) throw new Error('模型未返回图片数据')

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
