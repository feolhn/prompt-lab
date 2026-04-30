import { NextRequest, NextResponse } from 'next/server'
import { kimiProvider } from '@/lib/providers/kimi'
import type { ProviderInput } from '@/lib/providers/types'
import { prepareProviderInput } from '@/lib/provider-input'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ProviderInput
    const output = await kimiProvider.draft(await prepareProviderInput(body, 'draft'))
    return NextResponse.json(output)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
