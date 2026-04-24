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
目标：一张竖版手机长图（2:3），放在 Reuters、纽约时报或 The New Yorker 的数字版里不违和。
- 第一次看到这张图的人，不需要读原文，也能感受到内容的核心价值
- 手机屏幕上不放大也能舒适读清所有文字
- 左下角嵌入装饰性方形二维码，旁边标注："180K，分享有价值的前沿资讯。"

以下是内容：`

export const PROMPT_TEXTS: Record<Exclude<PromptVersion, 'custom'>, string> = {
  A: `你是一位顶级科技/财经媒体的资深图片编辑。看完这篇内容，直接做出你认为最好的那张图，不需要解释。${BASE_CONSTRAINTS}`,

  B: `从这篇内容里找出最值得被记住的那一个点——用一张图让人看完觉得"必须转发给某某"。${BASE_CONSTRAINTS}`,

  C: `先判断这篇内容的核心是什么类型：新概念、关键数据、还是重要事件——然后选最能让人一眼抓住重点的视觉表达方式。${BASE_CONSTRAINTS}`,
}

export const DEFAULT_PROMPT = PROMPT_TEXTS.C
