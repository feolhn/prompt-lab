'use client'

import { useState, useRef, useEffect } from 'react'
import { upload } from '@vercel/blob/client'
import type { Run } from '@/lib/types'
import type { ProviderOutput, ConversationMessage, ImageCanvas, ImageQuality, AnalysisProvider } from '@/lib/providers/types'
import { IMAGE_CANVAS_OPTIONS, IMAGE_QUALITY_OPTIONS } from '@/lib/providers/types'

type Quality = ImageQuality
type Canvas = ImageCanvas

const QUALITY_LABELS: Record<Quality, string> = { low: '低', medium: '中', high: '高' }
const QUALITY_DESCS: Record<Quality, string> = {
  low: '低价快速，适合草图预览',
  medium: '成本均衡，适合日常成图',
  high: '最高质量，适合最终交付',
}

const CANVAS_LABELS: Record<Canvas, string> = {
  '1024x1536': '竖版',
  '1536x1024': '横版',
  '1024x1024': '方版',
}

const QUICK_CHIPS = ['更简洁', '换配色', '更多细节', '中英双语', '突出关键数字']

const THINKING_PHRASES = [
  '正在读取内容…',
  '理解文章结构…',
  '提炼核心观点…',
  '规划视觉层次…',
  '生成图片脚本…',
]

const GENERATING_PHRASES = [
  '构建画面布局…',
  '渲染图形元素…',
  '调整色彩层次…',
  '细化文字排版…',
  '即将完成…',
]

type Attachment = { blobUrl: string; mimeType: string; filename: string }
type UserMsg = { role: 'user'; text: string; attachmentName?: string }
type AssistantMsg = { role: 'assistant' } & ProviderOutput
type ImageMsg = { role: 'image'; run: Run }
type ChatMsg = UserMsg | AssistantMsg | ImageMsg

type GenerateParams = {
  imagePromptEn: string
  artifactSpec: string
  canvas: Canvas
  quality: Quality
  inputSummaryCn: string
}

function conversationContent(msg: UserMsg | AssistantMsg): string {
  if (msg.role === 'user') {
    return msg.text.trim() || (msg.attachmentName ? `用户上传了附件：${msg.attachmentName}` : '')
  }

  return [
    `中文摘要：${msg.assistantSummaryCn}`,
    `英文图片 Prompt：${msg.imagePromptEn}`,
    `Artifact Spec：${msg.artifactSpec}`,
  ].join('\n\n')
}

async function readJsonResponse<T>(res: Response): Promise<T & { error?: string }> {
  const contentType = res.headers.get('content-type') ?? ''
  const body = await res.text()

  if (!contentType.includes('application/json')) {
    const preview = body.trim().slice(0, 200)
    throw new Error(`服务端返回了非 JSON 响应（${res.status}）：${preview || res.statusText || '空响应'}`)
  }

  let data: T & { error?: string }
  try {
    data = JSON.parse(body) as T & { error?: string }
  } catch {
    throw new Error(`服务端 JSON 解析失败（${res.status}）：${body.slice(0, 200)}`)
  }

  if (!res.ok || data.error) {
    throw new Error(data.error || `请求失败（${res.status}）`)
  }

  return data
}

function formatElapsed(seconds: number) {
  if (seconds < 60) return `${seconds}秒`
  return `${Math.floor(seconds / 60)}分${seconds % 60}秒`
}

export function PromptLab({ initialRuns }: { initialRuns: Run[] }) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [runs, setRuns] = useState<Run[]>(initialRuns)
  const [input, setInput] = useState('')
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [thinkingSeconds, setThinkingSeconds] = useState(0)
  const [generatingSeconds, setGeneratingSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [expandedModal, setExpandedModal] = useState<Run | null>(null)
  const [analysisProvider, setAnalysisProvider] = useState<AnalysisProvider>('kimi')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [uploadingFile, setUploadingFile] = useState(false)

  const hasConversation = messages.some((m) => m.role === 'assistant')

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!isThinking) return
    const timer = window.setInterval(() => setThinkingSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(timer)
  }, [isThinking])

  useEffect(() => {
    if (!isGenerating) return
    const timer = window.setInterval(() => setGeneratingSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(timer)
  }, [isGenerating])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploadingFile(true)
    setError(null)
    try {
      const objectName = `uploads/${crypto.randomUUID()}-${file.name}`
      const blob = await upload(objectName, file, {
        access: 'public',
        handleUploadUrl: '/api/uploads/token',
      })
      setAttachment({ blobUrl: blob.url, mimeType: file.type, filename: file.name })
    } catch (err) {
      setError(err instanceof Error ? err.message : '文件上传失败')
    } finally {
      setUploadingFile(false)
    }
  }

  async function handleSend(overrideText?: string) {
    const text = (overrideText ?? input).trim()
    if (!text && !attachment) return
    setError(null)

    const userMsg: UserMsg = { role: 'user', text, attachmentName: attachment?.filename }
    const newMessages: ChatMsg[] = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setAttachment(null)

    const hasPrior = messages.some((m) => m.role === 'assistant')
    const endpoint = hasPrior ? '/api/prompt-lab/revise' : '/api/prompt-lab/draft'

    const conversation: ConversationMessage[] = newMessages
      .filter((m): m is UserMsg | AssistantMsg => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: conversationContent(m) }))
      .filter((m) => m.content.trim().length > 0)

    setThinkingSeconds(0)
    setIsThinking(true)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          attachments: attachment ? [attachment] : [],
          conversation: hasPrior ? conversation : undefined,
          analysisProvider,
        }),
      })
      const data = await readJsonResponse<ProviderOutput>(res)
      setMessages((prev) => [...prev, { role: 'assistant', ...data }])
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败，请重试')
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setIsThinking(false)
    }
  }

  async function handleGenerate({ imagePromptEn, artifactSpec, canvas, quality, inputSummaryCn }: GenerateParams) {
    setError(null)
    setGeneratingSeconds(0)
    setIsGenerating(true)
    try {
      const res = await fetch('/api/prompt-lab/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagePromptEn,
          artifactSpec,
          canvas,
          qualityHint: quality,
          inputSummaryCn,
        }),
      })
      const data = await readJsonResponse<Run>(res)
      setMessages((prev) => [...prev, { role: 'image', run: data }])
      setRuns((prev) => [data, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : '生图失败，请重试')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/prompt-lab/history/${id}`, { method: 'DELETE' })
      setRuns((prev) => prev.filter((r) => r.id !== id))
    } catch {
      setError('删除失败，请重试')
    }
  }

  const busy = isThinking || isGenerating || uploadingFile

  return (
    <div className="flex flex-col h-full bg-white text-gray-900 max-w-lg mx-auto">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <h1 className="font-semibold text-base tracking-tight">瞬见</h1>
        <div className="ml-auto flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setAnalysisProvider('kimi')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              analysisProvider === 'kimi'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            国内
          </button>
          <button
            onClick={() => setAnalysisProvider('poe-gemini')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              analysisProvider === 'poe-gemini'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            国外
          </button>
        </div>
      </header>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* Chat area */}
        <div className="px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">
              粘贴文章、数据或上传文件，生成信息图
            </p>
          )}

          {messages.map((msg, i) => {
            if (msg.role === 'user') {
              return (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] bg-orange-50 border border-orange-100 rounded-2xl rounded-tr-sm px-4 py-3">
                    {msg.attachmentName && (
                      <p className="text-xs text-orange-400 mb-1">📎 {msg.attachmentName}</p>
                    )}
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              )
            }

            if (msg.role === 'assistant') {
              return (
                <AssistantBubble
                  key={i}
                  msg={msg}
                  onGenerate={(params) => handleGenerate(params)}
                  disabled={busy}
                />
              )
            }

            if (msg.role === 'image') {
              return (
                <div key={i} className="flex justify-start">
                  <div
                    className="cursor-pointer rounded-xl overflow-hidden border border-gray-100 shadow-sm"
                    onClick={() => setExpandedModal(msg.run)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={msg.run.imageUrl} alt="生成图片" className="w-48 object-cover" />
                  </div>
                </div>
              )
            }

            return null
          })}

          {isThinking && (
            <div className="flex justify-start">
              <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                <span className="text-sm text-gray-400 animate-pulse">
                  {THINKING_PHRASES[Math.floor(thinkingSeconds / 8) % THINKING_PHRASES.length]}
                  <span className="text-xs ml-1.5 opacity-60">{formatElapsed(thinkingSeconds)}</span>
                </span>
              </div>
            </div>
          )}

          {isGenerating && (
            <div className="flex justify-start">
              <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                <span className="text-sm text-gray-400 animate-pulse">
                  {GENERATING_PHRASES[Math.floor(generatingSeconds / 8) % GENERATING_PHRASES.length]}
                  <span className="text-xs ml-1.5 opacity-60">{formatElapsed(generatingSeconds)}</span>
                </span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* History */}
        {runs.length > 0 && (
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400 flex-shrink-0">历史记录</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="space-y-2">
              {runs.map((run) => (
                <HistoryItem
                  key={run.id}
                  run={run}
                  onExpand={() => setExpandedModal(run)}
                  onDelete={() => handleDelete(run.id)}
                  onRegenerate={() =>
                    handleGenerate({
                      imagePromptEn: run.imagePromptEn,
                      artifactSpec: run.artifactSpec,
                      canvas: run.canvas ?? '1024x1536',
                      quality: run.qualityHint ?? 'low',
                      inputSummaryCn: run.inputSummaryCn,
                    })
                  }
                  disabled={busy}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 px-3 py-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* Quick chips */}
      {hasConversation && !busy && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto flex-shrink-0 scrollbar-hide">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => handleSend(chip)}
              className="flex-shrink-0 px-3 py-1 text-xs border border-gray-200 rounded-full text-gray-500 hover:border-orange-300 hover:text-orange-600 transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Input composer */}
      <div className="flex-shrink-0 border-t border-gray-100 px-4 py-3 space-y-2 bg-white">
        {attachment && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-100 rounded-lg">
            <span className="text-xs text-orange-600 truncate flex-1">
              {attachment.mimeType === 'application/pdf' ? '📄' : '🖼️'} {attachment.filename}
            </span>
            <button
              onClick={() => setAttachment(null)}
              className="text-orange-400 hover:text-orange-600 text-xs flex-shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:border-orange-300 focus-within:ring-1 focus-within:ring-orange-100">
          <textarea
            className="w-full px-4 pt-3 pb-1 text-sm resize-none focus:outline-none placeholder-gray-400 min-h-[72px] max-h-40"
            placeholder="粘贴任何内容、链接或上传文件…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
            }}
          />
          <div className="flex items-center justify-between px-3 pb-2">
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={busy}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="text-gray-400 hover:text-orange-500 disabled:opacity-40 transition-colors"
                title="上传文件"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
              </button>
            </div>
            <span className="text-xs text-gray-300">{input.length}/2000</span>
          </div>
        </div>

        <button
          onClick={() => handleSend()}
          disabled={busy || (!input.trim() && !attachment)}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {uploadingFile
            ? '上传中…'
            : isThinking
              ? `分析中… ${formatElapsed(thinkingSeconds)}`
              : isGenerating
                ? `生成中… ${formatElapsed(generatingSeconds)}`
                : '确认生成'}
        </button>
      </div>

      {/* Modal */}
      {expandedModal && (
        <ImageModal run={expandedModal} onClose={() => setExpandedModal(null)} />
      )}
    </div>
  )
}

function AssistantBubble({
  msg,
  onGenerate,
  disabled,
}: {
  msg: AssistantMsg
  onGenerate: (params: GenerateParams) => void
  disabled: boolean
}) {
  const [promptOpen, setPromptOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [quality, setQuality] = useState<Quality>('low')
  const [canvas, setCanvas] = useState<Canvas>(msg.canvas)

  async function handleCopy() {
    await navigator.clipboard.writeText(msg.imagePromptEn)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 space-y-2">
        <p className="text-sm text-gray-800 leading-relaxed">{msg.assistantSummaryCn}</p>

        {msg.warnings && msg.warnings.length > 0 && (
          <p className="text-xs text-amber-600">⚠️ {msg.warnings.join('；')}</p>
        )}

        {/* Prompt toggle + copy */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPromptOpen((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {promptOpen ? '▼ 收起 Prompt' : '▶ 查看英文 Prompt'}
          </button>
          {promptOpen && (
            <button
              onClick={handleCopy}
              className="text-xs text-gray-400 hover:text-orange-500 transition-colors"
            >
              {copied ? '已复制' : '复制'}
            </button>
          )}
        </div>

        {promptOpen && (
          <pre className="text-xs text-gray-500 bg-white border border-gray-100 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">
            {msg.imagePromptEn}
          </pre>
        )}

        {/* Controls: canvas / quality */}
        <div className="space-y-1.5 pt-0.5">
          {/* Canvas */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-6 flex-shrink-0">画布</span>
            <div className="flex gap-1 flex-1">
              {(IMAGE_CANVAS_OPTIONS as readonly Canvas[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCanvas(c)}
                  className={`flex-1 py-1 text-xs font-medium rounded-md border transition-colors ${
                    canvas === c
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-orange-300'
                  }`}
                >
                  {CANVAS_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-6 flex-shrink-0">质量</span>
            <div className="flex gap-1 flex-1">
              {(IMAGE_QUALITY_OPTIONS as readonly Quality[]).map((q) => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  className={`flex-1 py-1 text-xs font-medium rounded-md border transition-colors ${
                    quality === q
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-orange-300'
                  }`}
                >
                  {QUALITY_LABELS[q]}
                </button>
              ))}
            </div>
          </div>

          {/* Contextual description */}
          <p className="text-xs text-gray-400 text-center leading-tight">
            {QUALITY_DESCS[quality]}
          </p>
        </div>

        <button
          onClick={() =>
            onGenerate({
              imagePromptEn: msg.imagePromptEn,
              artifactSpec: msg.artifactSpec,
              canvas,
              quality,
              inputSummaryCn: msg.inputSummaryCn,
            })
          }
          disabled={disabled}
          className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          确认生成
        </button>
      </div>
    </div>
  )
}

function HistoryItem({
  run,
  onExpand,
  onDelete,
  onRegenerate,
  disabled,
}: {
  run: Run
  onExpand: () => void
  onDelete: () => void
  onRegenerate: () => void
  disabled: boolean
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0" onClick={onExpand} role="button">
        <p className="text-sm text-gray-700 line-clamp-2 leading-snug">{run.inputSummaryCn}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {new Date(run.createdAt).toLocaleString('zh', {
            month: 'numeric', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={run.imageUrl}
        alt=""
        className="w-12 h-16 object-cover rounded-lg cursor-pointer flex-shrink-0 border border-gray-100"
        onClick={onExpand}
      />
      <div className="flex flex-col gap-1 flex-shrink-0">
        <button
          onClick={onRegenerate}
          disabled={disabled}
          className="text-xs text-gray-400 hover:text-orange-500 disabled:opacity-40 transition-colors leading-none"
          aria-label="重生成"
        >
          重生成
        </button>
        <button
          onClick={onDelete}
          className="text-gray-300 hover:text-red-400 transition-colors p-0.5"
          aria-label="删除"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function ImageModal({ run, onClose }: { run: Run; onClose: () => void }) {
  async function handleDownload() {
    const res = await fetch(run.imageUrl)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `180k-${run.id.slice(0, 8)}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="max-h-full overflow-auto rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={run.imageUrl} alt="生成图片" className="max-w-sm w-full rounded-xl" />
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-sm text-gray-300">
            {new Date(run.createdAt).toLocaleString('zh')}
          </span>
          <button
            onClick={handleDownload}
            className="text-sm text-white/70 hover:text-white underline underline-offset-2"
          >
            下载
          </button>
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
