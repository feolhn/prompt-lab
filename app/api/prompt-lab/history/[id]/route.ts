import { NextRequest, NextResponse } from 'next/server'
import { deleteRun } from '@/lib/storage'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await deleteRun(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
