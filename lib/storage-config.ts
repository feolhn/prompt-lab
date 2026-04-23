export type RunStoreMode = 'kv' | 'redis' | 'none'

export function getRunStoreMode(env: NodeJS.ProcessEnv): RunStoreMode {
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    return 'kv'
  }

  if (env.REDIS_URL) {
    return 'redis'
  }

  return 'none'
}
