'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { generateImage } from '@/app/actions'
import { PROMPT_TEXTS, type PromptVersion, type Run } from '@/lib/types'

type Group = { hash: string; snippet: string; runs: Run[] }

function groupRuns(runs: Run[]): Group[] {
  const map = new Map<string, Group>()
  for (const run of runs) {
    if (!map.has(run.contentHash)) {
      map.set(run.contentHash, { hash: run.contentHash, snippet: run.contentSnippet, runs: [] })
    }
    map.get(run.contentHash)!.runs.push(run)
  }
  return Array.from(map.values())
}

const VERSION_COLORS: Record<PromptVersion, string> = {
  A: 'bg-orange-500',
  B: 'bg-green-500',
  C: 'bg-blue-500',
  custom: 'bg-purple-500',
}

const VERSION_LABELS: Record<PromptVersion, string> = {
  A: '方案 A',
  B: '方案 B',
  C: '方案 C',
  custom: '自定义',
}

export function PromptLab({ initialRuns }: { initialRuns: Run[] }) {
  const [runs, setRuns] = useState<Run[]>(initialRuns)
  const [content, setContent] = useState('')
  const [promptVersion, setPromptVersion] = useState<PromptVersion>('C')
  const [customPrompt, setCustomPrompt] = useState('')
  const [stylePrompt, setStylePrompt] = useState('')
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [promptExpanded, setPromptExpanded] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [isPending, startTransition] = useTransition()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isPending) {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isPending])

  const groups = groupRuns(runs)
  const compareRuns = runs.filter((r) => compareIds.includes(r.id))

  function handleGenerate() {
    if (!content.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        const run = await generateImage(
          content,
          promptVersion,
          promptVersion === 'custom' ? customPrompt : undefined,
          stylePrompt || undefined,
        )
        setRuns((prev) => [run, ...prev])
      } catch (e) {
        setError(e instanceof Error ? e.message : '生成失败，请重试')
      }
    })
  }

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  return (
    <div className="flex h-full overflow-hidden bg-gray-50 text-gray-900">
      {/* 左侧：输入区 */}
      <aside className="w-88 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white" style={{ width: 352 }}>
        <div className="px-4 py-3 border-b border-gray-200">
          <h1 className="text-base font-semibold tracking-tight">Prompt Lab</h1>
          <p className="text-xs text-gray-400 mt-0.5">图片生成 prompt 调试工具</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 内容输入 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">原始内容</label>
            <textarea
              className="w-full h-52 text-sm border border-gray-300 rounded-lg p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              placeholder="粘贴原始文章内容..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* Prompt 方案选择 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Prompt 方案</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(['A', 'B', 'C', 'custom'] as PromptVersion[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setPromptVersion(v)}
                  disabled={isPending}
                  className={`py-1.5 text-sm rounded-md font-medium transition-colors ${
                    promptVersion === v
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {VERSION_LABELS[v]}
                </button>
              ))}
            </div>
          </div>

          {/* 自定义 prompt 编辑器 */}
          {promptVersion === 'custom' ? (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">自定义 Prompt</label>
              <textarea
                className="w-full h-36 text-sm border border-gray-300 rounded-lg p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                placeholder="输入自定义 prompt..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                disabled={isPending}
              />
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-500">当前 Prompt：</p>
                <button
                  onClick={() => setPromptExpanded((v) => !v)}
                  className="text-xs text-blue-500 hover:text-blue-700"
                >
                  {promptExpanded ? '收起' : '展开'}
                </button>
              </div>
              <p className={`text-xs text-gray-500 leading-relaxed whitespace-pre-wrap ${promptExpanded ? '' : 'line-clamp-4'}`}>
                {PROMPT_TEXTS[promptVersion]}
              </p>
            </div>
          )}

          {/* 风格提示词 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              风格提示词
              <span className="ml-1 text-gray-400 font-normal">（可选，留空则由模型自行决定）</span>
            </label>
            <textarea
              className="w-full h-20 text-sm border border-gray-300 rounded-lg p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              placeholder="例：扁平插画风，主色调深蓝+白，无衬线字体，极简排版"
              value={stylePrompt}
              onChange={(e) => setStylePrompt(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* 生成按钮 */}
          <button
            onClick={handleGenerate}
            disabled={isPending || !content.trim()}
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                生成中… {elapsed}s
              </span>
            ) : (
              '生成图片'
            )}
          </button>
        </div>
      </aside>

      {/* 右侧：历史区 */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-700">
              历史记录
              {runs.length > 0 && (
                <span className="ml-2 text-gray-400 font-normal">{runs.length} 条</span>
              )}
            </h2>
            {compareIds.length === 2 && (
              <button
                onClick={() => setExpandedId('__compare__')}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                并排对比
              </button>
            )}
          </div>

          {groups.length === 0 ? (
            <div className="text-center text-gray-400 py-24 text-sm">
              暂无记录，生成第一张图片后显示
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map((group) => (
                <ContentGroup
                  key={group.hash}
                  group={group}
                  compareIds={compareIds}
                  onToggleCompare={toggleCompare}
                  onExpand={setExpandedId}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 全屏查看 */}
      {expandedId && expandedId !== '__compare__' && (() => {
        const run = runs.find((r) => r.id === expandedId)
        return run ? (
          <ImageModal run={run} onClose={() => setExpandedId(null)} />
        ) : null
      })()}

      {/* 并排对比 */}
      {expandedId === '__compare__' && compareRuns.length === 2 && (
        <CompareModal runs={compareRuns as [Run, Run]} onClose={() => setExpandedId(null)} />
      )}
    </div>
  )
}

function ContentGroup({
  group,
  compareIds,
  onToggleCompare,
  onExpand,
}: {
  group: Group
  compareIds: string[]
  onToggleCompare: (id: string) => void
  onExpand: (id: string) => void
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-baseline justify-between">
        <p className="text-sm font-medium text-gray-700 truncate max-w-lg">{group.snippet}</p>
        <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{group.runs.length} 条</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-3">
        {group.runs.map((run) => (
          <RunCard
            key={run.id}
            run={run}
            selected={compareIds.includes(run.id)}
            onToggleCompare={() => onToggleCompare(run.id)}
            onExpand={() => onExpand(run.id)}
          />
        ))}
      </div>
    </div>
  )
}

function RunCard({
  run,
  selected,
  onToggleCompare,
  onExpand,
}: {
  run: Run
  selected: boolean
  onToggleCompare: () => void
  onExpand: () => void
}) {
  return (
    <div
      className={`rounded-lg border-2 overflow-hidden transition-all ${
        selected ? 'border-indigo-500 shadow-md shadow-indigo-100' : 'border-transparent'
      }`}
    >
      <div className="relative cursor-pointer" onClick={onExpand}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={run.imageUrl}
          alt="生成图片"
          className="w-full h-44 object-cover object-top bg-gray-100"
        />
        <span
          className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 text-xs font-bold text-white rounded ${VERSION_COLORS[run.promptVersion]}`}
        >
          {run.promptVersion === 'custom' ? '自定' : run.promptVersion}
        </span>
      </div>
      <div className="px-2 pt-1.5 pb-1 bg-white flex items-center justify-between gap-1">
        <time className="text-xs text-gray-400" dateTime={run.createdAt}>
          {new Date(run.createdAt).toLocaleTimeString('zh', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleCompare()
          }}
          className={`text-xs px-2 py-0.5 rounded transition-colors ${
            selected
              ? 'bg-indigo-100 text-indigo-700'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {selected ? '已选' : '对比'}
        </button>
      </div>
      {run.stylePrompt && (
        <p className="px-2 pb-1.5 text-xs text-gray-400 truncate bg-white" title={run.stylePrompt}>
          🎨 {run.stylePrompt}
        </p>
      )}
    </div>
  )
}

function ImageModal({ run, onClose }: { run: Run; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="max-h-full overflow-auto rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={run.imageUrl} alt="生成图片" className="max-w-xs w-full rounded-xl" />
        <div className="text-center mt-2 text-sm text-gray-300">
          {VERSION_LABELS[run.promptVersion]} ·{' '}
          {new Date(run.createdAt).toLocaleString('zh')}
        </div>
      </div>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl leading-none"
        aria-label="关闭"
      >
        ✕
      </button>
    </div>
  )
}

function CompareModal({ runs, onClose }: { runs: [Run, Run]; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex gap-6 p-6 overflow-auto"
      onClick={onClose}
    >
      {runs.map((run) => (
        <div
          key={run.id}
          className="flex-1 flex flex-col items-center gap-2 min-w-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-white text-sm font-medium">
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-bold mr-2 ${VERSION_COLORS[run.promptVersion]}`}
            >
              {run.promptVersion === 'custom' ? '自定义' : `方案 ${run.promptVersion}`}
            </span>
            {new Date(run.createdAt).toLocaleString('zh')}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={run.imageUrl}
            alt="生成图片"
            className="w-full max-w-xs rounded-xl"
          />
        </div>
      ))}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl leading-none"
        aria-label="关闭"
      >
        ✕
      </button>
    </div>
  )
}
