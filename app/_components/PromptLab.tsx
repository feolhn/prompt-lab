'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { generateImage } from '@/app/actions'
import { DEFAULT_PROMPT, type Run } from '@/lib/types'

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

type Attachment = {
  base64: string
  mimeType: string
  filename: string
}

export function PromptLab({ initialRuns }: { initialRuns: Run[] }) {
  const [runs, setRuns] = useState<Run[]>(initialRuns)
  const [content, setContent] = useState('')
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [promptText, setPromptText] = useState(DEFAULT_PROMPT)
  const [stylePrompt, setStylePrompt] = useState('')
  const [imageSize, setImageSize] = useState<'1K' | '2K'>('1K')
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [isPending, startTransition] = useTransition()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',', 2)[1] ?? ''
      setAttachment({ base64, mimeType: file.type, filename: file.name })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleGenerate() {
    if (!content.trim() && !attachment) return
    setError(null)
    startTransition(async () => {
      try {
        const run = await generateImage(
          content,
          'custom',
          promptText,
          stylePrompt || undefined,
          attachment ?? undefined,
          imageSize,
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
              className="w-full h-40 text-sm border border-gray-300 rounded-lg p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              placeholder="粘贴原始文章内容（可选，支持同时上传文件）..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* 文件上传 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              上传文件
              <span className="ml-1 text-gray-400 font-normal">（PDF / 图片，可选）</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={isPending}
            />
            {attachment ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="text-sm text-blue-700 truncate flex-1" title={attachment.filename}>
                  {attachment.mimeType === 'application/pdf' ? '📄' : '🖼️'} {attachment.filename}
                </span>
                <button
                  onClick={() => setAttachment(null)}
                  disabled={isPending}
                  className="text-blue-400 hover:text-blue-600 flex-shrink-0 text-xs"
                  aria-label="移除文件"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isPending}
                className="w-full py-2 text-sm border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                点击选择文件
              </button>
            )}
          </div>

          {/* Prompt 编辑器 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Prompt</label>
            <textarea
              className="w-full h-40 text-sm border border-gray-300 rounded-lg p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* 清晰度 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              清晰度
              <span className="ml-1 text-gray-400 font-normal">（2K 更慢、更贵）</span>
            </label>
            <div className="flex gap-2">
              {(['1K', '2K'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setImageSize(size)}
                  disabled={isPending}
                  className={`flex-1 py-1.5 text-sm rounded-md font-medium transition-colors ${
                    imageSize === size
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

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
            disabled={isPending || (!content.trim() && !attachment)}
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
  const [promptOpen, setPromptOpen] = useState(false)

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
      </div>
      <div className="px-2 pt-1.5 pb-1 bg-white flex items-center justify-between gap-1">
        <time className="text-xs text-gray-400" dateTime={run.createdAt}>
          {new Date(run.createdAt).toLocaleTimeString('zh', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setPromptOpen((v) => !v) }}
            className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          >
            {promptOpen ? '收起' : 'Prompt'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleCompare() }}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              selected
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {selected ? '已选' : '对比'}
          </button>
        </div>
      </div>
      {promptOpen && (
        <div className="px-2 pb-2 bg-white">
          <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded p-2 border border-gray-100">
            {run.promptText}
          </p>
          {run.stylePrompt && (
            <p className="mt-1 text-xs text-gray-400 truncate" title={run.stylePrompt}>
              风格：{run.stylePrompt}
            </p>
          )}
        </div>
      )}
      {!promptOpen && run.stylePrompt && (
        <p className="px-2 pb-1.5 text-xs text-gray-400 truncate bg-white" title={run.stylePrompt}>
          风格：{run.stylePrompt}
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
