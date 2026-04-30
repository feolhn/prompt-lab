export const IMAGE_CANVAS_OPTIONS = ['1024x1536', '1536x1024', '1024x1024'] as const
export type ImageCanvas = (typeof IMAGE_CANVAS_OPTIONS)[number]

export const IMAGE_QUALITY_OPTIONS = ['low', 'medium', 'high'] as const
export type ImageQuality = (typeof IMAGE_QUALITY_OPTIONS)[number]

export const ANALYSIS_PROVIDER_OPTIONS = ['kimi', 'poe-gemini'] as const
export type AnalysisProvider = (typeof ANALYSIS_PROVIDER_OPTIONS)[number]

export type ConversationMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type ProviderAttachment = {
  blobUrl: string
  mimeType: string
  filename: string
  dataUrl?: string
  extractedText?: string
}

export type ProviderInput = {
  text?: string
  attachments?: ProviderAttachment[]
  conversation?: ConversationMessage[]
  previousSpec?: string
  allowWebSearch?: boolean
  analysisProvider?: AnalysisProvider
}

export type ProviderOutput = {
  assistantSummaryCn: string
  imagePromptEn: string
  artifactSpec: string
  canvas: ImageCanvas
  qualityHint: ImageQuality
  inputSummaryCn: string
  warnings?: string[]
  providerDiagnostics: {
    model: string
    durationMs: number
    cacheHit?: boolean
    error?: string
  }
}

export interface MaterialUnderstandingProvider {
  draft(input: ProviderInput): Promise<ProviderOutput>
  revise(input: ProviderInput): Promise<ProviderOutput>
}

export interface ImageGenerationProvider {
  generate(prompt: string, canvas: ImageCanvas, quality: ImageQuality): Promise<string>
}
