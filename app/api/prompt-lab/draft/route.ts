import { NextRequest, NextResponse } from 'next/server'
import type { ProviderInput } from '@/lib/providers/types'
import { prepareProviderInput } from '@/lib/provider-input'
import { getAnalysisProvider } from '@/lib/providers/analysis'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ProviderInput
    const provider = getAnalysisProvider(body.analysisProvider)
    const output = await provider.draft(await prepareProviderInput(body, 'draft'))
    return NextResponse.json(output)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
