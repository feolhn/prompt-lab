import type { ProviderAttachment, ProviderInput } from './providers/types'

const MOONSHOT_API_BASE = 'https://api.moonshot.cn/v1'

export async function prepareProviderAttachments(input: ProviderInput): Promise<ProviderInput> {
  if (!input.attachments?.length) return input

  return {
    ...input,
    attachments: await Promise.all(input.attachments.map(prepareAttachment)),
  }
}

async function prepareAttachment(attachment: ProviderAttachment): Promise<ProviderAttachment> {
  if (attachment.mimeType === 'application/pdf') return preparePdfAttachment(attachment)
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

async function preparePdfAttachment(attachment: ProviderAttachment): Promise<ProviderAttachment> {
  if (attachment.extractedText) return attachment

  const apiKey = process.env.MOONSHOT_API_KEY
  if (!apiKey) throw new Error('未配置 MOONSHOT_API_KEY，无法读取 PDF 附件')

  const pdfRes = await fetch(attachment.blobUrl)
  if (!pdfRes.ok) {
    const body = await pdfRes.text()
    throw new Error(`PDF 附件读取失败（${pdfRes.status}）：${body.slice(0, 200)}`)
  }

  const pdfBytes = await pdfRes.arrayBuffer()
  if (pdfBytes.byteLength === 0) throw new Error('PDF 附件读取结果为空')

  const form = new FormData()
  form.append('purpose', 'file-extract')
  form.append('file', new Blob([pdfBytes], { type: attachment.mimeType }), attachment.filename)

  const uploadRes = await fetch(`${MOONSHOT_API_BASE}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
  if (!uploadRes.ok) {
    const body = await uploadRes.text()
    throw new Error(`Kimi PDF 上传失败（${uploadRes.status}）：${body.slice(0, 200)}`)
  }

  const uploadData = await uploadRes.json() as { id?: string }
  const fileId = uploadData.id
  if (!fileId) throw new Error(`Kimi PDF 上传未返回 file id：${JSON.stringify(uploadData).slice(0, 200)}`)

  const contentRes = await fetch(`${MOONSHOT_API_BASE}/files/${fileId}/content`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!contentRes.ok) {
    const body = await contentRes.text()
    throw new Error(`Kimi PDF 内容提取失败（${contentRes.status}）：${body.slice(0, 200)}`)
  }

  const extractedText = (await contentRes.text()).trim()
  if (!extractedText) throw new Error('Kimi PDF 内容提取结果为空')

  return { ...attachment, extractedText }
}
