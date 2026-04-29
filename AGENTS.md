<!-- BEGIN:nextjs-agent-rules -->
# Next.js 16

Before changing framework behavior, check `node_modules/next/dist/docs/`.
<!-- END:nextjs-agent-rules -->

# Prompt Lab

- Read `STATE.md` only when project context, handoff, or current status matters.
- Update `STATE.md` when status, blockers, verification, or next steps change.
- Keep third-party API experiments out of product code.
- For Kimi, OpenAI image, Poe, URL, attachment, JSON schema, or skill workflow issues, check `/Users/hujiawei/Documents/180k/integration-lab` first.
- Use `integration-lab` as API evidence, not product proof. If product behavior differs, locate the first diverging boundary before changing code.
- Do not overwrite unrelated dirty worktree changes.

- Verification:
  - `node --test lib/*.test.ts lib/providers/*.test.ts`
  - `npm run lint`
  - `npm run build`
