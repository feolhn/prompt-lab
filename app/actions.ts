'use server'

import { getAllRuns } from '@/lib/storage'
import type { Run } from '@/lib/types'

export async function getHistory(): Promise<Run[]> {
  return getAllRuns()
}
