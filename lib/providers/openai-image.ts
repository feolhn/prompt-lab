import type { ImageCanvas, ImageGenerationProvider, ImageQuality } from './types'

export function buildOpenAIImageRequest(
  prompt: string,
  canvas: ImageCanvas,
  quality: ImageQuality,
) {
  const [width, height] = canvas.split('x')
  const size = `${width}x${height}` as `${number}x${number}`

  return {
    model: 'gpt-image-2',
    prompt,
    size,
    quality,
    output_format: 'png',
    n: 1,
  }
}

export const openaiImageProvider: ImageGenerationProvider = {
  async generate(prompt: string, canvas: ImageCanvas, quality: ImageQuality): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('未配置 OPENAI_API_KEY')

    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildOpenAIImageRequest(prompt, canvas, quality)),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenAI Images API 错误（${res.status}）：${err.slice(0, 200)}`)
    }

    const data = await res.json() as { data: Array<{ b64_json?: string }> }
    const b64 = data.data?.[0]?.b64_json
    if (!b64) throw new Error(`OpenAI 未返回图片数据：${JSON.stringify(data).slice(0, 200)}`)

    return b64
  },
}
