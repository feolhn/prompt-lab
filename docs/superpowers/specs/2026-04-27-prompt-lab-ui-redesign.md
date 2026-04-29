# Prompt Lab UI 重构设计规格

**日期**：2026-04-27
**状态**：待实现

---

## 目标

将 Prompt Lab 从桌面端左右分栏布局重构为移动端优先的对话式单列界面。用户在手机上打开链接即可完整操作：输入内容 → AI 分析生成可视化方案 → 多轮对话修改 → 确认生图 → 查看历史。

---

## 第一节：整体布局与交互模型

### 页面结构（单列，移动端优先）

```
┌───────────────────────────────┐
│  🧪 Prompt Lab                │  固定 header
├───────────────────────────────┤
│  对话区（当前 session，可滚动）  │
│  [用户气泡] 粘贴的文章内容...   │
│  [助手气泡]                    │
│    中文摘要：已整理为一张...    │
│    ▶ 查看英文 Prompt（折叠）   │
│    [确认生成] 按钮             │
│  [用户气泡] 改成横版           │
│  [助手气泡] 已调整...          │
│    [确认生成] 按钮             │
│  [图片结果气泡] 🖼️             │
├───────────────────────────────┤
│  历史记录（持久化，所有历史）   │
│  [摘要]          [thumb] 🗑️  │
│  2024-06-01 10:30             │
├───────────────────────────────┤
│  输入框（固定底部）             │
│  粘贴内容、链接或文件...        │
│  ⬆️ 📄                0/2000  │
│  [       确认生成       ]      │
└───────────────────────────────┘
```

### 交互流程

1. 用户输入内容（文字 / 图片附件 / PDF）→ 点"确认生成" → 触发 **Step 1**（KimiProvider.draft）
2. Assistant 气泡出现：中文摘要 + 折叠英文 Prompt + "确认生成"按钮
3. 用户可继续在输入框发消息修改（"改成横版"）→ 触发 **Step 1**（KimiProvider.revise）→ 新 Assistant 气泡
4. 用户点任意"确认生成"按钮 → 触发 **Step 2**（ImageGenerationProvider.generate）
5. 图片以气泡形式出现，同时追加到历史列表

### 关键设计决策

- 对话 session 仅存 React state，刷新即清（图片历史照常持久化）
- 每个 Assistant 气泡有独立"确认生成"按钮，可回到任意版本生图
- 英文 Prompt 默认折叠，移动端不占空间
- 无设置面板、无对比功能、无 A/B/C 预设——MVP

---

## 第二节：组件拆分与状态

### 客户端状态（`PromptLab` 顶层）

```typescript
type UserMessage    = { role: 'user'; text: string; attachmentName?: string }
type AssistantMessage = { role: 'assistant'; summary: string; englishPrompt: string }
type ImageMessage   = { role: 'image'; run: Run }
type ChatMessage    = UserMessage | AssistantMessage | ImageMessage

// 状态
messages:    ChatMessage[]       // 当前 session，刷新清空
runs:        Run[]               // 历史，从 Redis 加载
input:       string              // 输入框
attachment:  Attachment | null   // 待上传附件
isThinking:  boolean             // Step 1 进行中
isGenerating: boolean            // Step 2 进行中
error:       string | null
```

### 组件树

```
PromptLab
├── ChatArea              可滚动对话区
│   ├── UserBubble        用户气泡
│   ├── AssistantBubble   摘要 + 折叠英文 Prompt + "确认生成"按钮
│   └── ImageBubble       缩略图，点击全屏
├── HistorySection        持久化历史列表
│   └── HistoryItem       摘要 + 缩略图 + 删除按钮
├── ImageModal            全屏查看 + 下载（保留现有逻辑）
└── InputComposer         固定底部：textarea + 文件上传 + "确认生成"
```

---

## 第三节：API 集成

### 环境变量

```
MOONSHOT_API_KEY    # Kimi K2.6（MaterialUnderstandingProvider 默认实现）
OPENAI_API_KEY      # gpt-image-2（ImageGenerationProvider）
# 移除 OPENROUTER_API_KEY
```

### Provider 抽象

```typescript
// 对话消息（用于多轮修改上下文）
type ConversationMessage = {
  role: 'user' | 'assistant'
  content: string
}

// 输入
type ProviderInput = {
  text?: string
  attachments?: Array<{ blobUrl: string; mimeType: string; filename: string }>
  conversation?: ConversationMessage[]   // 含历史轮次，供 revise 使用
  previousSpec?: string
}

// 输出（统一 schema）
type ProviderOutput = {
  assistantSummaryCn: string   // 展示给用户
  imagePromptEn:      string   // 内部，不展示
  artifactSpec:       string
  canvas:             string   // 如 "1024x1536"
  qualityHint:        'medium' | 'high'
  inputSummaryCn:     string   // 历史记录展示用
  warnings?:          string[]
  providerDiagnostics: {
    model: string; durationMs: number; cacheHit?: boolean; error?: string
  }
}

interface MaterialUnderstandingProvider {
  draft(input: ProviderInput): Promise<ProviderOutput>
  revise(input: ProviderInput): Promise<ProviderOutput>
}

interface ImageGenerationProvider {
  generate(prompt: string, canvas: string, quality: 'medium' | 'high'): Promise<string> // base64
}
```

### KimiProvider 实现要点

- 模型：`kimi-k2-5`（或最新 K2.6 标识，以 Moonshot 文档为准）
- 不传 `temperature`（Kimi 默认 1，语义不同于 OpenAI，不可改）
- skill `visual-info-prompting` 的 `SKILL.md` 全文作为 system prompt 固定前缀（命中 prompt caching）
- PDF/图片通过 Moonshot Files API 上传拿 `file_id`，传 `input_file`
- 图片 vision：`detail: "high"`（用户上传图表密集内容）
- 联网搜索通过 Kimi 内置 search tool 触发
- 输出强制 JSON schema；不稳定时服务端一次 fix-retry
- 记录 `providerDiagnostics`

### ImageGenerationProvider（OpenAI）

```json
{
  "model": "gpt-image-2",
  "prompt": "<imagePromptEn>",
  "size": "1024x1536",
  "quality": "medium",
  "output_format": "b64_json"
}
```

- 默认 `quality: "medium"`（约 $0.041/张），MVP 不开放 high

### Route Handlers

| 路由 | 说明 |
|---|---|
| `POST /api/uploads/token` | Vercel Blob 客户端直传 token |
| `POST /api/prompt-lab/draft` | KimiProvider.draft → 返回摘要 |
| `POST /api/prompt-lab/revise` | KimiProvider.revise → 返回修改摘要 |
| `POST /api/prompt-lab/generate` | ImageGenerationProvider.generate → 存 Blob + Redis → 返回 Run |
| `DELETE /api/prompt-lab/history/[id]` | 删 Redis + Blob（直接删，无撤销） |
| `GET /api/prompt-lab/history` | 读 Redis |

---

## 第四节：历史记录与删除

### `Run` schema 更新

```typescript
type Run = {
  id:             string
  contentHash:    string
  inputSummaryCn: string   // 历史列表展示（原 contentSnippet）
  imageUrl:       string
  createdAt:      string
  // 后端存储，前端不展示：
  imagePromptEn:  string
  artifactSpec:   string
}
```

### 历史列表 UI

```
┌─────────────────────────────────────┐
│ 未来城市，日落时分，飞行汽车...      │  inputSummaryCn，2行截断
│ 2024-06-01 10:30     [thumb] 🗑️    │  时间 + 缩略图 + 删除
└─────────────────────────────────────┘
```

- 点击缩略图 → `ImageModal`（全屏 + 下载）
- 点击删除 → 调 `DELETE /api/prompt-lab/history/[id]` → 删 Redis + Blob → 刷新列表
- 按 `createdAt` 降序，不分组

### `deleteRun` 后端逻辑

```typescript
async function deleteRun(id: string): Promise<void> {
  const run = await getRun(id)
  await Promise.all([
    redis.del(`run:${id}`),
    redis.lrem('runs', 0, id),
    del(run.imageUrl),   // Vercel Blob delete
  ])
}
```

---

## 废弃内容

以下现有代码在重构后删除：

- `lib/openrouter.ts` — 完全废弃
- `lib/types.ts` 中的 `PromptVersion`、`PROMPT_TEXTS`、`DEFAULT_PROMPT`
- `PromptLab.tsx` 中的 `ContentGroup`、`CompareModal`、`promptVersion` state、`compareIds` state、`stylePrompt` state
- `app/actions.ts` 中的 `generateImage`（替换为 Route Handlers）

---

## 不在本次范围内

- 链接抓取（后续迭代）
- `quality: "high"` 生图入口（后续迭代）
- 对话历史持久化（后续迭代）
- Provider 切换 UI（后续迭代，代码已抽象）
