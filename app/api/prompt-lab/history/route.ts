import { NextResponse } from 'next/server'
import { getAllRuns } from '@/lib/storage'

export async function GET() {
  try {
    const runs = await getAllRuns()
    return NextResponse.json(runs)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
