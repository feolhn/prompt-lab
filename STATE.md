# 项目状态白板

两个 agent 都可以直接覆盖更新这个文件。不是日志，是当前快照。

---

## 当前状态

**生产域名**：https://prompt-lab-peach.vercel.app
**仓库**：https://github.com/feolhn/prompt-lab

### 架构（2026-04-27 重构完成）

完整替换为 Kimi + Poe Image2 provider 架构，UI 重构为移动端对话式。OpenAI provider 保留为预留实现。

| 层 | 实现 | 状态 |
|---|---|---|
| 材料理解层 | `lib/providers/kimi.ts` → Moonshot API `kimi-k2.6` | ✅ Preview 产品级 smoke 通过 |
| 生图层 | `lib/providers/poe-image.ts` → Poe `gpt-image-2` | ✅ Preview 产品级 smoke 通过 |
| UI | `app/_components/PromptLab.tsx` 对话式 | ✅ 本地跑通 |
| 历史删除 | `DELETE /api/prompt-lab/history/[id]` | ✅ Preview 产品级 smoke 通过 |

### 环境变量（本地 .env.local）

| 变量 | 状态 |
|------|------|
| MOONSHOT_API_KEY | ✅ 已配置 |
| POE_API_KEY | ✅ 已配置 |
| OPENAI_API_KEY | 预留，暂时不用 |
| BLOB_READ_WRITE_TOKEN | ✅ 已配置 |
| REDIS_URL | ✅ 已配置 |

---

## 当前问题 / 处理结果

### 问题 1：URL 输入没有抓取页面内容（高优先级）

**现象**：用户输入 `https://openai.com/index/introducing-gpt-5-5/`，Kimi 只收到了 URL 字符串，没有读取页面内容，直接基于 URL 猜测文章内容返回幻觉结果。

**日志证据**：
```
[Kimi] → last user message preview: {"role":"user","content":"https://openai.com/index/introducing-gpt-5-5/"}
[Kimi] ← tokens: {"prompt_tokens":2586,"completion_tokens":346,"total_tokens":2932}
[Kimi] ← response preview: {
  "assistantSummaryCn": "将OpenAI官网上关于GPT-5.5介绍的文章转化为信息图，突出关键特性和更新。",
  "imagePromptEn": "H1: Introducing GPT-5.5\nSection 1: Enhanced Capabilities\nSection 2: Improved Performance..."
}
```
只有 346 completion tokens，明显没做深度分析，全是套模板。

**根本原因**：`/api/prompt-lab/draft` route 直接把用户输入的 URL 字符串传给 Kimi；同时实测 `openai.com` 对普通服务端抓取返回 Cloudflare 403，单纯 `fetch` 不是可靠 MVP。

**处理结果（2026-04-27）**：
- URL 输入统一改为 Kimi 官方 `$web_search` 工具路径，不再先做服务端 HTML fetch。
- `draft` 和 `revise` 都会识别单独 URL，把用户消息改写为“使用联网搜索读取真实页面内容”，并设置 `allowWebSearch=true`。
- Kimi provider 已实现 `$web_search` tool-call loop：收到 `finish_reason=tool_calls` 后把 tool arguments 原样作为 tool message 交回 Kimi，再等待最终 JSON。

### 问题 2：确认 Kimi K2 正确 model ID（中优先级）

**处理结果（2026-04-27）**：
- Moonshot / Kimi 官方文档当前推荐联网搜索使用 `model: "kimi-k2.6"`。
- `$web_search` 声明为 `tools: [{ "type": "builtin_function", "function": { "name": "$web_search" } }]`。
- 使用 `$web_search` 时需要 `thinking: { "type": "disabled" }`。
- 代码已从 `moonshot-v1-128k` 切到 `kimi-k2.6`。

### 问题 3：OpenAI `gpt-image-2` 参数错误

**根本原因**：代码把 `output_format` 传成了 `b64_json`。OpenAI GPT Image 模型的 Image API 默认返回 `b64_json` 数据；`output_format` 表示文件格式，应为 `png` / `jpeg` / `webp`。

**处理结果（2026-04-27）**：
- `lib/providers/openai-image.ts` 改为 `output_format: "png"`。
- 仍从 `data[0].b64_json` 读取返回图片。

### 问题 4：PDF 附件传给 Kimi chat 报 invalid part type: file

**现象**：线上上传 PDF 后，Kimi 返回 400：`message ... contains an invalid part type: file`。

**根本原因**：Kimi chat completions 不接受当前代码构造的 `{ type: "file" }` message part。integration-lab 已验证的 Kimi 文件路径是先走 Files API `purpose=file-extract`，再读取 `/files/{file_id}/content`，最后把提取文本放入 chat message。

**处理结果（2026-04-29）**：
- `lib/provider-attachments.ts` 对 `application/pdf` 附件改为：下载 Blob → `POST /v1/files` 上传到 Kimi → `GET /v1/files/{id}/content` 获取正文 → 写入 `attachment.extractedText`。
- `lib/providers/kimi.ts` 不再发送 `type: "file"`；PDF 附件会作为普通文本 part 传给 Kimi。
- 如果 PDF 没有提前提取文本，provider 会 fail fast：`PDF 附件尚未提取文本`。

---

## 架构说明（供 Codex 参考）

### Provider 抽象

```
lib/providers/
├── types.ts          # ProviderInput / ProviderOutput / 接口定义
├── kimi.ts           # MaterialUnderstandingProvider 实现
├── poe-image.ts      # 默认 ImageGenerationProvider 实现
├── openai-image.ts   # ImageGenerationProvider 实现
└── skill-prompt.md   # visual-info-prompting skill 全文（system prompt）
```

### API Routes

```
app/api/prompt-lab/
├── draft/route.ts         # 首次输入 → KimiProvider.draft
├── revise/route.ts        # 多轮修改 → KimiProvider.revise
├── generate/route.ts      # 确认生图 → Poe Image2
└── history/
    ├── route.ts           # GET 历史
    └── [id]/route.ts      # DELETE 单条
app/api/uploads/token/route.ts  # Vercel Blob 直传 token
```

### ProviderOutput schema（Kimi 需返回的 JSON）

```typescript
{
  assistantSummaryCn: string   // 展示给用户的中文摘要
  imagePromptEn: string        // 内部英文 prompt，不展示
  artifactSpec: string
  canvas: '1024x1536' | '1536x1024' | '1024x1024'
  qualityHint: 'low' | 'medium' | 'high'
  inputSummaryCn: string       // 历史记录展示用，≤30字
  warnings?: string[]
}
```

### 关键约束

- Kimi：`kimi-k2.6`；不传 `temperature`；显式 `thinking: disabled`
- URL 输入：明确 URL 优先走 Kimi official `moonshot/fetch:latest` 读取 Markdown 正文，再把正文交给 Kimi draft；不依赖 `$web_search`。本地 curl/fetch 仍可作为普通网页参考，但 OpenAI 官网受 Cloudflare 保护时应使用 Kimi fetch。
- 生图：默认走 Poe `/v1/chat/completions`，`POE_IMAGE_MODEL=gpt-image-2`，请求体直接传 `size: canvas` 和 `quality: qualityHint`，从 Poe 返回文本提取图片 URL，下载后转 base64 再存 Blob
- OpenAI：`lib/providers/openai-image.ts` 保留为预留实现，当前 `/api/prompt-lab/generate` 不使用
- skill prompt 路径：`lib/providers/skill-prompt.md`（打包进项目）
- Vercel Function body 上限约 4.5MB，附件走 Blob 直传

---

## 验证清单

- [x] URL 输入 → 触发 Kimi `$web_search` 工具路径（代码与请求体测试通过）
- [x] 纯文本输入 → Kimi 正常返回结构化 JSON
- [x] PDF 上传 → 走 Kimi Files API 提取文本后再交给 Kimi chat（代码与单测通过）
- [x] 图片上传 → 服务端将 Blob 图片转 `data:image/...;base64,...` 后交给 Kimi，产品级 smoke 通过
- [x] 确认生成 → 已切到 Poe Image2，Preview 产品级 smoke 通过
- [x] 历史记录删除 → Redis + Blob 同步删除，Preview 产品级 smoke 通过

### 本地验证（2026-04-27）

- `node --test lib/*.test.ts lib/providers/*.test.ts` ✅ 7 tests passed
- `npm run lint` ✅
- `npm run build` ✅（需要联网拉取 `next/font` 的 Google Fonts）

### 本地验证（2026-04-29）

- `node --test lib/*.test.ts lib/providers/*.test.ts` ✅ 11 tests passed
- `npm run lint` ✅
- `npm run build` ✅（首次受沙箱网络限制无法拉取 Google Fonts；联网权限下通过）
- 产品级 smoke：`POST /api/prompt-lab/draft` 纯文本 ✅，本地 route → Kimi → JSON schema 返回成功
- 产品级 smoke：`POST /api/prompt-lab/draft` URL ✅，`https://www.iana.org/help/example-domains` 通过 Kimi fetch 读取正文 → Kimi draft → JSON schema 返回成功。
- 产品级 smoke：`POST /api/prompt-lab/draft` 受保护 URL ✅，`https://openai.com/index/introducing-gpt-5-5/` 通过 Kimi fetch 读取正文 → Kimi draft → 返回 GPT-5.5 发布文章摘要和 image prompt。
- 产品级 smoke：`POST /api/prompt-lab/draft` 图片附件 ✅，Vercel Blob JPG 先转 data URL → Kimi vision → 返回图片内容摘要和 image prompt。
- 上传 UX ✅：客户端上传路径使用 `uploads/{uuid}-{filename}`，避免重复上传同名文件触发 Vercel Blob already exists。
- 产品级 smoke：`POST /api/prompt-lab/generate` ✅ 本地 route → Poe Image2 → Blob upload → Redis save 返回成功；测试 run 已删除。
- 移动端 UI smoke ✅：Playwright iPhone 视口完成首页输入 → draft → 确认生图 → 图片渲染；`/api/prompt-lab/draft` 200，`/api/prompt-lab/generate` 200，测试 run `a417f422-c23a-4881-bad8-63a4c67b8cf5` 已删除。截图：`output/playwright/mobile-01-initial.png`、`mobile-02-draft.png`、`mobile-03-image.png`。
- 等待态 UI ✅：分析内容和生成图片两个阶段都会显示已等待秒数，避免长请求看起来像卡住。
- 本地 Next dev 若要访问 Poe，需要临时 Node proxy bootstrap，不写入产品代码：
  ```sh
  source ~/.zshrc
  proxy >/dev/null 2>&1
  export http_proxy=http://127.0.0.1:7897 https_proxy=http://127.0.0.1:7897
  export HTTP_PROXY=http://127.0.0.1:7897 HTTPS_PROXY=http://127.0.0.1:7897
  export no_proxy=localhost,127.0.0.1,::1 NO_PROXY=localhost,127.0.0.1,::1
  export NODE_TLS_REJECT_UNAUTHORIZED=0
  unset all_proxy ALL_PROXY
  NODE_OPTIONS="--require /private/tmp/prompt-lab-node-proxy.cjs" npm run dev
  ```
  `/private/tmp/prompt-lab-node-proxy.cjs` uses `undici` `EnvHttpProxyAgent`.

### 本地验证（2026-04-29 UI 批次二）

- `node --test lib/*.test.ts lib/providers/*.test.ts` ✅ 16 tests passed
- `npm run lint` ✅
- `npm run build` ✅
- 后端合同已补齐：`lib/providers/types.ts` 导出 `IMAGE_CANVAS_OPTIONS` / `IMAGE_QUALITY_OPTIONS`；`POST /api/prompt-lab/generate` 校验 `canvas` 和 `qualityHint` 后传给 Poe；新 `Run` 会存 `canvas` / `qualityHint`，老历史缺省由 UI 按 `1024x1536` / `low` 处理
- UI 新增功能（主要在 `app/_components/PromptLab.tsx`）：
  - 画布选择（竖版/横版/方版）：`AssistantBubble` 内新增"画布"行，默认用 Kimi 推荐值
  - 质量选择（低/中/高）：原有功能重构为带标签行，默认用 Kimi 推荐值
  - Prompt 复制：展开 Prompt 时右上角显示"复制/已复制"按钮
  - 快捷 chip：有对话时输入框上方显示（更简洁/换配色/更多细节/中英双语/突出关键数字），点击自动发送
  - 历史复用：每条历史记录新增"重生成"按钮，直接用该条记录的 `imagePromptEn` 再次生图
- 删除信息密度控件：`密度` 原实现是在客户端给 `imagePromptEn` 追加英文 layout hint，效果不稳定且绕过 skill 判断；已移除。当前客户端不再拼接/改写生图 prompt，`imagePromptEn` 直接来自 Kimi/skill。
- Poe request builder 单测覆盖默认 `1024x1536` / `low` 和显式 `1536x1024` / `high`

### Preview 验证（2026-04-29）

- Latest Preview URL: `https://prompt-f6eyxdty9-feolhns-projects.vercel.app`
- Latest Deployment: `dpl_euZed21N8dRxHaf1vuz7EdnoxB5P`
- Preview URL: `https://prompt-jn0pz8zd2-feolhns-projects.vercel.app`
- Deployment: `dpl_FYsH1Yu6H24DdjRPF71HQodc2VdC`
- Vercel env: `MOONSHOT_API_KEY`, `POE_API_KEY`, `POE_IMAGE_MODEL`, `POE_GEMINI_MODEL`, `BLOB_READ_WRITE_TOKEN`, `REDIS_URL` present for Preview.
- `POST /api/prompt-lab/draft` ✅ Kimi route → JSON schema returned successfully.
- `POST /api/prompt-lab/generate` ✅ Poe Image2 → image URL download → Blob upload → Redis save returned a Run successfully.
- `GET /api/prompt-lab/history` ✅ returned the generated smoke run.
- `DELETE /api/prompt-lab/history/[id]` ✅ returned `{ "ok": true }`; follow-up history confirmed the smoke run was removed.
