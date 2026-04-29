export function isHttpUrl(text: string): boolean {
  const trimmed = text.trim()
  if (!/^https?:\/\//i.test(trimmed) || /\s/.test(trimmed)) return false

  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function normalizeUrlInput(text: string): string {
  const url = new URL(text.trim())
  url.hash = ''
  return url.toString()
}

export async function fetchReadableUrlContent(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 PromptLab/1.0 URL content fetcher',
      Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!res.ok) {
    const protectedHint = res.status === 401 || res.status === 403
      ? '。该网站可能阻止服务器抓取；请改为粘贴正文，或上传 PDF/截图。'
      : ''
    throw new Error(`URL 页面抓取失败（${res.status}）${protectedHint}`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  const raw = await res.text()
  const text = contentType.includes('html') ? extractHtmlText(raw) : normalizeWhitespace(raw)

  if (text.length < 80) {
    throw new Error('URL 页面可抽取正文过少；请改为粘贴正文，或上传 PDF/截图。')
  }

  return `URL: ${url}\n\n${text.slice(0, 12000)}`
}

export function extractHtmlText(html: string): string {
  const withoutNoise = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<(p|div|section|article|header|footer|li|h[1-3]|br)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  return normalizeWhitespace(decodeHtmlEntities(withoutNoise))
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}
