import type { ImageCanvas, ImageGenerationProvider, ImageQuality } from './types'

const POE_CHAT_COMPLETIONS_URL = 'https://api.poe.com/v1/chat/completions'
export const DEFAULT_POE_IMAGE_MODEL = 'gpt-image-2'

type PoeChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string }
  }>
}

export function getPoeImageModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.POE_IMAGE_MODEL || DEFAULT_POE_IMAGE_MODEL
}

export function buildPoeImageRequest(
  prompt: string,
  model = DEFAULT_POE_IMAGE_MODEL,
  size: ImageCanvas = '1024x1536',
  quality: ImageQuality = 'low',
) {
  return {
    model,
    messages: [{ role: 'user', content: prompt }],
    size,
    quality,
    stream: false,
  }
}

export function extractPoeImageUrl(content: string): string {
  const markdownUrl = content.match(/!\[[^\]]*]\((https?:\/\/[^)]+)\)/)?.[1]
  if (markdownUrl) return markdownUrl

  const plainUrl = content.match(/https?:\/\/\S+/)?.[0]
  if (plainUrl) return plainUrl.replace(/[),.]+$/, '')

  throw new Error('Poe 未返回图片 URL')
}

async function downloadImageAsBase64(imageUrl: string): Promise<string> {
  let res: Response
  try {
    res = await fetch(imageUrl)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '未知错误'
    throw new Error(`Poe 图片下载请求失败：${msg}`)
  }

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Poe 图片下载失败（${res.status}）：${err.slice(0, 200)}`)
  }

  const imageBytes = Buffer.from(await res.arrayBuffer())
  if (imageBytes.length === 0) throw new Error('Poe 图片下载结果为空')
  return imageBytes.toString('base64')
}

export const poeImageProvider: ImageGenerationProvider = {
  async generate(prompt: string, canvas: ImageCanvas, quality: ImageQuality = 'low'): Promise<string> {
    const apiKey = process.env.POE_API_KEY
    if (!apiKey) throw new Error('未配置 POE_API_KEY')

    let res: Response
    try {
      res = await fetch(POE_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildPoeImageRequest(prompt, getPoeImageModel(), canvas, quality)),
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : '未知错误'
      throw new Error(`Poe Image2 请求失败：${msg}`)
    }

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Poe Image2 API 错误（${res.status}）：${err.slice(0, 200)}`)
    }

    const data = await res.json() as PoeChatCompletionResponse
    const content = data.choices?.[0]?.message?.content ?? ''
    const imageUrl = extractPoeImageUrl(content)
    return downloadImageAsBase64(imageUrl)
  },
}
