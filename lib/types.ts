export type PromptVersion = 'A' | 'B' | 'C' | 'custom'

export type Run = {
  id: string
  contentHash: string
  contentSnippet: string
  promptVersion: PromptVersion
  promptText: string
  stylePrompt: string
  imageUrl: string
  createdAt: string
}

const BASE_CONSTRAINTS = `
基础要求：
- 竖版长图，宽度 1024px，高度由内容决定
- 底部留约 200px 空白（用于后期叠加二维码）
- 目标读者：从未接触过这篇内容的普通人，看到朋友转发后第一次打开
- 核心标准：让人停住手指，想转发

以下是内容：`

export const PROMPT_TEXTS: Record<Exclude<PromptVersion, 'custom'>, string> = {
  A: `你是一位顶级科技/财经媒体的资深图片编辑，你在看到这篇内容的第一瞬间，就知道配什么图——你不需要解释理由，直接创作出那张你认为最有传播力的手机长图。${BASE_CONSTRAINTS}`,

  B: `从这篇内容中，找出那个让普通读者看完会觉得"原来如此"或"这太夸张了"的核心——用一张手机长图把这个核心表达得一目了然，不需要读原文也能感受到它的分量。${BASE_CONSTRAINTS}`,

  C: `先判断这篇内容的核心价值属于哪种类型：是一个需要解释的新概念、一组关键数据/趋势、还是一个重要事件/决策——然后用最适合在手机上传播的方式把它的核心视觉化。让第一次看到这张图的人，不需要读原文，也能感受到这篇内容的核心价值。${BASE_CONSTRAINTS}`,
}
