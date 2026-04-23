@AGENTS.md

# 跨 Agent 协作

handoff/ 目录是 Claude 和 Codex 的消息箱：
- `handoff/claude-to-codex.md` — Claude 写给 Codex 的任务
- `handoff/codex-to-claude.md` — Codex 写回的结论

**每次对话开始时先读 `handoff/codex-to-claude.md`**，看是否有 Codex 的回复需要处理。
写给 Codex 的任务追加到 `handoff/claude-to-codex.md` 顶部，格式参照文件内已有示例。

# Vercel 运行时问题处理规范

Codex app 装有 Vercel CLI plugin，可以直接查看生产日志、环境变量和部署状态。

遇到 Vercel 线上运行时错误（非构建错误）时：
- 不要用 Claude Code 的 codex:rescue skill 去处理
- 由 Claude Code 写一个 handoff prompt，用户复制给 Codex app 执行
- handoff prompt 需包含：生产域名、仓库、错误现象、已确认环境变量、关键文件路径、需要排查的层级
