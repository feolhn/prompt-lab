import type { ProviderInput } from './providers/types'
import { prepareProviderAttachments } from './provider-attachments'
import { fetchUrlWithKimi } from './providers/kimi-fetch'
import { isHttpUrl, normalizeUrlInput } from './url-content'

export async function prepareProviderInput(input: ProviderInput, mode: 'draft' | 'revise'): Promise<ProviderInput> {
  const prepared: ProviderInput = await prepareProviderAttachments({ ...input })

  if (prepared.text) {
    await applyUrlContentFetch(prepared, prepared.text, (text) => {
      prepared.text = text
    })
  }

  if (mode === 'revise' && prepared.conversation) {
    const conversation = [...prepared.conversation]
    const last = conversation[conversation.length - 1]

    if (last?.role === 'user') {
      await applyUrlContentFetch(prepared, last.content, (content) => {
        conversation[conversation.length - 1] = { ...last, content }
      })
    }

    prepared.conversation = conversation
  }

  return prepared
}

async function applyUrlContentFetch(input: ProviderInput, text: string, setText: (text: string) => void) {
  if (!isHttpUrl(text)) return

  const url = normalizeUrlInput(text)
  const content = await fetchUrlWithKimi(url)
  setText(`请基于以下 Kimi fetch 读取到的 URL 真实页面内容进行分析，不要仅凭 URL 猜测。\n\n${content}`)
  input.allowWebSearch = false
}
