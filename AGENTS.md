<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Multi-Agent Collaboration

This project may be edited by both Claude Code and Codex.

- Treat both agents as active collaborators in the same codebase.
- Do not overwrite or discard another agent's work without understanding it first.
- Pass task context between agents through handoff prompts rather than informal summaries.

## Handoff Channel

The handoff workflow is defined in [CLAUDE.md](/Users/hujiawei/Documents/180k/wiki-graph/prompt-lab/CLAUDE.md) and the files under [handoff](/Users/hujiawei/Documents/180k/wiki-graph/prompt-lab/handoff).

- `handoff/claude-to-codex.md`: Claude writes tasks or requests for Codex.
- `handoff/codex-to-claude.md`: Codex writes conclusions, status updates, or unblock notes for Claude.

Before starting work that depends on prior collaboration, read the relevant handoff file first.
When handing work off, write or update the prompt in the agreed handoff format instead of inventing a new protocol.
