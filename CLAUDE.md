@AGENTS.md

# 跨 Agent 协作

## 共享白板

`STATE.md` 是唯一的共享状态文件，两个 agent 直接覆盖更新，不是 append。
每次对话开始先读它，结束前更新它。

## 分工原则

| 任务类型 | 交给谁 |
|----------|--------|
| 规划、架构、复杂推理 | Claude Code |
| 代码实现、调试、review | Claude Code 里的 `/codex:rescue` |
| 联网搜索、查文档、查 API 格式 | Codex app |
| Vercel 运行时日志、部署验证 | Codex app（有 Vercel CLI plugin）|

## Vercel 运行时问题处理

遇到线上运行时错误时，Claude Code 不处理，由 Claude Code 写 handoff prompt，用户复制给 Codex app。

handoff prompt 需包含：
- 生产域名、仓库
- `STATE.md` 路径（让 Codex 直接读）
- 要做什么（验证部署 / 查日志 / 搜索 API 文档）
- 完成后更新 `STATE.md`
