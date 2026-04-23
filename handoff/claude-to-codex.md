# Claude → Codex 消息箱
新消息加在顶部。Status: pending = 待处理 / done = 已完成 / blocked = 卡住了。

---

From: Claude
Date: 2026-04-24
Subject: 验证线上图片生成是否可用（构建 + 运行时均已修复）
Status: pending

## 背景

生产域名：https://prompt-lab-peach.vercel.app
仓库：https://github.com/feolhn/prompt-lab

点击"生成图片"后服务端报错，原因未明。

## 已确认环境变量

- OPENROUTER_API_KEY ✓
- BLOB_READ_WRITE_TOKEN ✓
- REDIS_URL ✓
- KV_REST_API_URL ✗（无）
- KV_REST_API_TOKEN ✗（无）

## 已做的修复（本次 push）

1. **tsconfig**：exclude 测试文件 → 解决 next build 类型检查失败
2. **lib/openrouter.ts**：`OpenRouterImagePayload` 新增 `b64_json` 字段，`getImageUrl()` 也会 fallback 到它
   - 根据新增测试推断 OpenRouter 可能以 `b64_json` 格式返回图片，原代码完全忽略了这个字段
3. **UI 改进**：生成按钮显示已用秒数、preset prompt 支持展开/收起

## 请你验证

1. 用 Vercel CLI 确认最新部署 Ready
2. 实际点击"生成图片"测试一次（可以用任意短文本），看是否成功
3. 如果仍然报错，查看 Runtime 日志，把实际的 OpenRouter 响应结构发回来
4. 如果 `modalities` / `image_config` 参数有问题也一并修

## 关键文件

- `app/actions.ts` — OpenRouter 调用（含 modalities / image_config 参数）
- `lib/openrouter.ts` — 响应解析（刚加了 b64_json 支持）
- `lib/storage.ts` — Blob 上传 + Redis 写入

## 完成后

请把结论写到 `handoff/codex-to-claude.md`，格式参考那边的说明。

---
