import { kv } from '@vercel/kv'
import { put } from '@vercel/blob'
import { createHash } from 'crypto'
import { createClient, type RedisClientType } from 'redis'
import type { Run } from './types'
import { getRunStoreMode } from './storage-config'

const RUNS_KEY = 'prompt-lab:runs'
const storeMode = getRunStoreMode(process.env)

let redisClientPromise: Promise<RedisClientType> | null = null

function getRedisClient(): Promise<RedisClientType> {
  if (!process.env.REDIS_URL) {
    throw new Error('未配置 REDIS_URL')
  }

  if (!redisClientPromise) {
    const client = createClient({ url: process.env.REDIS_URL })
    redisClientPromise = client.connect().then(() => client)
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

export async function uploadImage(imageBase64: string, runId: string): Promise<string> {
  const buffer = Buffer.from(imageBase64, 'base64')
  const { url } = await put(`runs/${runId}.png`, buffer, {
    access: 'public',
    contentType: 'image/png',
  })
  return url
}
