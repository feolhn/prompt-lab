import { kv } from '@vercel/kv'
import { put } from '@vercel/blob'
import { createHash } from 'crypto'
import type { Run } from './types'

const RUNS_KEY = 'prompt-lab:runs'

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

export async function saveRun(run: Run): Promise<void> {
  await kv.lpush(RUNS_KEY, JSON.stringify(run))
}

export async function getAllRuns(): Promise<Run[]> {
  const raw = await kv.lrange<string>(RUNS_KEY, 0, -1)
  return raw.map((r) => JSON.parse(r) as Run)
}

export async function uploadImage(imageBase64: string, runId: string): Promise<string> {
  const buffer = Buffer.from(imageBase64, 'base64')
  const { url } = await put(`runs/${runId}.png`, buffer, {
    access: 'public',
    contentType: 'image/png',
  })
  return url
}
