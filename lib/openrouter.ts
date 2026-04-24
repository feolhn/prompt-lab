type OpenRouterImagePayload = {
  image_url?: string | { url?: string }
  imageUrl?: string | { url?: string }
  url?: string
  b64_json?: string
}

type OpenRouterContentItem = {
  type?: string
  text?: string
  image_url?: string | { url?: string }
  imageUrl?: string | { url?: string }
  url?: string
}

type OpenRouterMessage = {
  images?: OpenRouterImagePayload[]
  content?: string | OpenRouterContentItem[]
}

type OpenRouterResponse = {
  images?: OpenRouterImagePayload[]
  choices?: Array<{
    message?: OpenRouterMessage
  }>
}

function getImageUrl(payload?: OpenRouterImagePayload): string | undefined {
  if (!payload) return undefined

  if (typeof payload.image_url === 'string') return payload.image_url
  if (typeof payload.imageUrl === 'string') return payload.imageUrl

  return payload.image_url?.url ?? payload.imageUrl?.url ?? payload.url ?? payload.b64_json
}

function stripDataUrlPrefix(value: string): string {
  return value.startsWith('data:') ? value.split(',', 2)[1] ?? '' : value
}

export function parseOpenRouterImageBase64(result: OpenRouterResponse): string {
  const messageContent = result.choices?.[0]?.message?.content
  const contentImageUrl = Array.isArray(messageContent)
    ? messageContent
        .map((item) =>
          getImageUrl({
            image_url: item.image_url,
            imageUrl: item.imageUrl,
            url: item.url,
          }),
        )
        .find(Boolean)
    : undefined

  const imageUrl =
    getImageUrl(result.choices?.[0]?.message?.images?.[0]) ??
    getImageUrl(result.images?.[0]) ??
    contentImageUrl

  const base64 = imageUrl ? stripDataUrlPrefix(imageUrl) : ''
  if (!base64) {
    throw new Error(`OpenRouter 未返回图片数据：${JSON.stringify(result).slice(0, 500)}`)
  }

  return base64
}
