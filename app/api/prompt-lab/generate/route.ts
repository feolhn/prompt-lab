import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { poeImageProvider } from '@/lib/providers/poe-image'
import { hashContent, saveRun, uploadImage } from '@/lib/storage'
import type { Run } from '@/lib/types'
import {
  IMAGE_CANVAS_OPTIONS,
  IMAGE_QUALITY_OPTIONS,
  type ImageCanvas,
  type ImageQuality,
} from '@/lib/providers/types'

export const maxDuration = 300

type GenerateRequest = {
  imagePromptEn: string
  artifactSpec: string
  canvas: ImageCanvas
  qualityHint: ImageQuality
  inputSummaryCn: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as GenerateRequest
    const { imagePromptEn, artifactSpec, canvas, qualityHint, inputSummaryCn } = body
    if (!IMAGE_CANVAS_OPTIONS.includes(canvas)) {
      return NextResponse.json({ error: `不支持的画幅：${canvas}` }, { status: 400 })
    }
    if (!IMAGE_QUALITY_OPTIONS.includes(qualityHint)) {
      return NextResponse.json({ error: `不支持的质量选项：${qualityHint}` }, { status: 400 })
    }

    const b64 = await poeImageProvider.generate(imagePromptEn, canvas, qualityHint)
    const id = randomUUID()
    const imageUrl = await uploadImage(b64, id)

    const run: Run = {
      id,
      contentHash: hashContent(inputSummaryCn),
      inputSummaryCn: inputSummaryCn.slice(0, 60).trim(),
      imageUrl,
      createdAt: new Date().toISOString(),
      imagePromptEn,
      artifactSpec,
      canvas,
      qualityHint,
    }

    await saveRun(run)
    return NextResponse.json(run)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
