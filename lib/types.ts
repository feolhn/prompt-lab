import type { ImageCanvas, ImageQuality } from './providers/types'

export type Run = {
  id: string
  contentHash: string
  inputSummaryCn: string
  imageUrl: string
  createdAt: string
  imagePromptEn: string
  artifactSpec: string
  canvas?: ImageCanvas
  qualityHint?: ImageQuality
}
