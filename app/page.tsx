import { getHistory } from './actions'
import { PromptLab } from './_components/PromptLab'
import type { Run } from '@/lib/types'

// gpt-image-2 生成可能需要 60-120 秒
export const maxDuration = 300

export default async function Page() {
  let initialRuns: Run[] = []
  try {
    initialRuns = await getHistory()
  } catch {
    // KV 未配置时静默失败，从空历史开始
  }
  return <PromptLab initialRuns={initialRuns} />
}
