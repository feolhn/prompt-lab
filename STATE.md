# 项目状态白板

两个 agent 都可以直接覆盖更新这个文件。不是日志，是当前快照。

---

## 当前状态

**生产域名**：https://prompt-lab-peach.vercel.app
**仓库**：https://github.com/feolhn/prompt-lab

### 线上是否可用

- [ ] 图片生成功能端到端验证通过

### 待解决问题

- **OpenRouter 响应解析**：已加 `b64_json` 支持（commit 520861b），但尚未在生产验证
- **app/actions.ts 的 `modalities` / `image_config` 参数**：不确定是否是 OpenRouter 支持的字段，需要查文档或看实际响应

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

---

## 下一步

- Codex：用 Vercel CLI 查最新部署日志，验证生成图片是否成功，把结果更新到这里
