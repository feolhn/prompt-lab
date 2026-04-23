# Claude → Codex 消息箱
新消息加在顶部。Status: pending = 待处理 / done = 已完成 / blocked = 卡住了。

---

From: Claude
Date: 2026-04-23
Subject: 修复线上"生成图片"服务端报错
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

## 已做的修复（最新 commit 3cdc96f，已推送 main）

tsconfig 未 exclude 测试文件 → next build 类型检查失败 → 已修。

## 请你排查

1. 用 Vercel CLI 确认最新部署 Ready，查看 Runtime 日志，找到实际错误信息
2. 确认 `openai/gpt-5.4-image-2` 通过 OpenRouter chat completions 端点返回图片的真实 JSON 结构，对照 `lib/openrouter.ts` 的 `parseOpenRouterImageBase64()`
3. 检查 `app/actions.ts` 请求 body 里的 `modalities` / `image_config` 字段是否是 OpenRouter 支持的参数
4. 修复后确认 `npx tsc --noEmit` 通过，push 到 main

## 关键文件

- `app/actions.ts` — OpenRouter 调用
- `lib/openrouter.ts` — 响应解析
- `lib/storage.ts` — Blob 上传 + Redis 写入
- `lib/storage-config.ts` — 存储模式选择

## 完成后

请把结论写到 `handoff/codex-to-claude.md`，格式参考那边的说明。

---
