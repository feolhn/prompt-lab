import { kv } from '@vercel/kv'
import { put, del } from '@vercel/blob'
import { createHash } from 'crypto'
import { createClient } from 'redis'
import type { Run } from './types'
import { getRunStoreMode } from './storage-config'

const RUNS_KEY = 'prompt-lab:runs'
const storeMode = getRunStoreMode(process.env)

type RedisClient = ReturnType<typeof createClient>

let redisClientPromise: Promise<RedisClient> | null = null

function getRedisClient(): Promise<RedisClient> {
  if (!process.env.REDIS_URL) {
    throw new Error('未配置 REDIS_URL')
  }

  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      const client = createClient({ url: process.env.REDIS_URL })
      await client.connect()
      return client
    })()
  }

  return redisClientPromise
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

export async function saveRun(run: Run): Promise<void> {
  const payload = JSON.stringify(run)

  if (storeMode === 'kv') {
    await kv.lpush(RUNS_KEY, payload)
    return
  }

  if (storeMode === 'redis') {
    const client = await getRedisClient()
    await client.lPush(RUNS_KEY, payload)
    return
  }

  throw new Error('未配置可用的历史记录存储')
}

export async function getAllRuns(): Promise<Run[]> {
  let raw: string[]

  if (storeMode === 'kv') {
    raw = await kv.lrange<string>(RUNS_KEY, 0, -1)
  } else if (storeMode === 'redis') {
    const client = await getRedisClient()
    raw = await client.lRange(RUNS_KEY, 0, -1)
  } else {
    return []
  }

  return raw.map((r) => JSON.parse(r) as Run)
}

export async function getRun(id: string): Promise<Run | null> {
  const runs = await getAllRuns()
  return runs.find((r) => r.id === id) ?? null
}

export async function deleteRun(id: string): Promise<void> {
  const run = await getRun(id)
  if (!run) return

  const allRuns = await getAllRuns()
  const remaining = allRuns.filter((r) => r.id !== id)

  if (storeMode === 'kv') {
    await kv.del(RUNS_KEY)
    if (remaining.length > 0) {
      await kv.rpush(RUNS_KEY, ...remaining.map((r) => JSON.stringify(r)))
    }
  } else if (storeMode === 'redis') {
    const client = await getRedisClient()
    await client.del(RUNS_KEY)
    if (remaining.length > 0) {
      await client.rPush(RUNS_KEY, remaining.map((r) => JSON.stringify(r)))
    }
  }

  await del(run.imageUrl)
}

export async function uploadImage(imageBase64: string, runId: string): Promise<string> {
  const buffer = Buffer.from(imageBase64, 'base64')
  const { url } = await put(`runs/${runId}.png`, buffer, {
    access: 'public',
    contentType: 'image/png',
  })
  return url
}
