import type { ProviderAttachment, ProviderInput } from './providers/types'

export async function prepareProviderAttachments(input: ProviderInput): Promise<ProviderInput> {
  if (!input.attachments?.length) return input

  return {
    ...input,
    attachments: await Promise.all(input.attachments.map(prepareAttachment)),
  }
}

async function prepareAttachment(attachment: ProviderAttachment): Promise<ProviderAttachment> {
  if (!attachment.mimeType.startsWith('image/')) return attachment
  if (attachment.dataUrl) return attachment

  const res = await fetch(attachment.blobUrl)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`图片附件读取失败（${res.status}）：${body.slice(0, 200)}`)
  }

  const imageBytes = Buffer.from(await res.arrayBuffer())
  if (imageBytes.length === 0) throw new Error('图片附件读取结果为空')

  return {
    ...attachment,
    dataUrl: `data:${attachment.mimeType};base64,${imageBytes.toString('base64')}`,
  }
}
