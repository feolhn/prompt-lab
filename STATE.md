# 项目状态白板

两个 agent 都可以直接覆盖更新这个文件。不是日志，是当前快照。

---

## 当前状态

**生产域名**：https://prompt-lab-peach.vercel.app
**仓库**：https://github.com/feolhn/prompt-lab

### 线上是否可用

- [x] 图片生成功能端到端验证通过
- [ ] 文件上传功能：已实现，**待线上验证**（PDF/图片是否被 OpenRouter 正确处理）

### 已实现功能

- 文件上传（PDF + 图片）：客户端 FileReader 读取 base64，传给 Server Action，按 OpenRouter 格式组装 multimodal content 数组
  - 图片：`{ type: "image_url", image_url: { url: "data:<mime>;base64,..." } }`
  - PDF：`{ type: "file", file: { filename, file_data: "data:application/pdf;base64,..." } }`
  - 无附件时仍走原来的 string content，不破坏现有路径

### 待解决问题

- **图片比例 / 清晰度参数（2026-04-24 Codex 查官方文档）**
  - OpenRouter `/api/v1/chat/completions` 图片生成通过 `image_config` 设置输出规格，示例：`{ "image_config": { "aspect_ratio": "16:9", "image_size": "4K" } }`。
  - `aspect_ratio` 可选值：`1:1`（默认，1024x1024）、`2:3`（832x1248）、`3:2`（1248x832）、`3:4`（864x1184）、`4:3`（1184x864）、`4:5`（896x1152）、`5:4`（1152x896）、`9:16`（768x1344）、`16:9`（1344x768）、`21:9`（1536x672）。扩展比例 `1:4`、`4:1`、`1:8`、`8:1` 仅文档标注为 `google/gemini-3.1-flash-image-preview` 支持。
  - `image_size` 可选值：`1K`（默认/标准）、`2K`（更高分辨率）、`4K`（最高分辨率）。`0.5K` 仅文档标注为 `google/gemini-3.1-flash-image-preview` 支持。
  - 注意：OpenRouter 新版文档把 `image_size` 写在通用 Image Configuration Options 下；旧路径文档曾写 `Image Size (Gemini only)`。对当前 `openai/gpt-5.4-image-2`，建议保留已跑通的 `1K`，若要上 `2K/4K`，先做小样本线上验证并记录耗时、成本和实际返回尺寸。
  - OpenAI 官方 `gpt-image-2` 模型页只明确写支持 flexible image sizes 和 high-fidelity image inputs；通过 OpenRouter 调用时，具体字段以 OpenRouter `image_config` 文档和线上验证为准。
  - 参考：
    - https://openrouter.ai/docs/guides/overview/multimodal/image-generation
    - https://openrouter.ai/docs/features/multimodal/image-generation
    - https://developers.openai.com/api/docs/models/gpt-image-2

### 环境变量（生产）

| 变量 | 状态 |
|------|------|
| OPENROUTER_API_KEY | ✓ |
| BLOB_READ_WRITE_TOKEN | ✓ |
| REDIS_URL | ✓ |
| KV_REST_API_URL | ✗ 无 |
| KV_REST_API_TOKEN | ✗ 无 |

---

## 最近做了什么

| 时间 | Who | 做了什么 |
|------|-----|----------|
| 2026-04-24 | Claude | fix: tsconfig exclude 测试文件，解决 next build 失败 |
| 2026-04-24 | Claude | fix: openrouter.ts 加 b64_json 支持 |
| 2026-04-24 | Claude | feat: 生成按钮显示已用秒数，preset prompt 支持展开收起 |
| 2026-04-24 | Codex | verify: Vercel 最新生产部署 Ready，最近 30 分钟无生产错误日志 |
| 2026-04-24 | User | verify: 实测点击生成图片成功并得到结果 |
| 2026-04-24 | Claude | feat: 文件上传（PDF/图片）multimodal 输入，无附件路径不变 |

---

## 下一步

- **线上验证文件上传**：上传一张图片 + 一个 PDF，看 OpenRouter 是否正确处理并生成图片
- 可选：如果 `imageUrl` 字段名让 OpenRouter 混淆（文档两种写法），可改用 `image_url`（已用 `image_url`，符合 OpenAI 标准）
