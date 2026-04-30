import { kimiProvider } from './kimi'
import { poeGeminiProvider } from './poe-gemini'
import type { AnalysisProvider, MaterialUnderstandingProvider } from './types'

export function getAnalysisProvider(provider: AnalysisProvider | undefined): MaterialUnderstandingProvider {
  if (provider === 'poe-gemini') return poeGeminiProvider
  return kimiProvider
}
