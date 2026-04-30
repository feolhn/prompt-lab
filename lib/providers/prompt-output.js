const CANVAS_OPTIONS = ['1024x1536', '1536x1024', '1024x1024']
const QUALITY_OPTIONS = ['low', 'medium', 'high']

export function parseProviderJsonOutput(text, model, durationMs) {
  const jsonText = extractJsonText(text)
  let parsed
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error(`${model} 返回的 JSON 无法解析：${text.slice(0, 300)}`)
  }

  if (!parsed.imagePromptEn || !parsed.assistantSummaryCn) {
    throw new Error(`${model} 返回结构不完整：${jsonText.slice(0, 300)}`)
  }

  return {
    assistantSummaryCn: parsed.assistantSummaryCn,
    imagePromptEn: parsed.imagePromptEn,
    artifactSpec: typeof parsed.artifactSpec === 'string'
      ? parsed.artifactSpec
      : JSON.stringify(parsed.artifactSpec ?? ''),
    canvas: CANVAS_OPTIONS.includes(parsed.canvas) ? parsed.canvas : '1024x1536',
    qualityHint: QUALITY_OPTIONS.includes(parsed.qualityHint) ? parsed.qualityHint : 'low',
    inputSummaryCn: parsed.inputSummaryCn ?? '',
    warnings: parsed.warnings ?? [],
    providerDiagnostics: {
      model,
      durationMs,
    },
  }
}

export function extractJsonText(text) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]
  if (fenced) return fenced.trim()

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1)

  return trimmed
}
