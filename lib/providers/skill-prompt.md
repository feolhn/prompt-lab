---
name: visual-info-prompting
description: "Prepare concise image-generation prompts for visual information design only: infographics, charts, data visualizations, presentation slides, scientific or educational diagrams, timelines, comparison modules, process flows, funnels, and diagram-heavy explainers. Use when Codex needs to turn structured content, research notes, data, or an investment thesis into a polished visual prompt; do not use for photography, logos, ads, product mockups, UI screens, comics, style transfer, object removal, compositing, interior design, holiday cards, collectibles, or children's books."
---

# Visual Info Prompting

## Source

- Official OpenAI guide: https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide

## Scope

Use this skill only for information-design images:
- Infographics and visual explainers: read [04-01-infographics.md](04-01-infographics.md)
- Scientific or educational diagrams: read [04-09-scientific.md](04-09-scientific.md)
- Slides, diagrams, charts, and data visualizations: read [04-10-slides-diagrams.md](04-10-slides-diagrams.md)

Always read [00-overview.md](00-overview.md) for current model, size, quality, and prompt fundamentals.

## Workflow

**Step 1 — Understand the artifact**

Before drafting, identify:
- Output type: infographic, chart, slide, timeline, comparison, process flow, funnel, scientific diagram, or explainer
- Audience and use case
- Main viewpoint or analytical angle
- Most important marginal change vs. prior period, consensus, or reader baseline
- True highlights: new signals, inflection points, contradictions, risks, or implications

Choose density and canvas:
- Default to **Fragmented** or **Standard**. Treat **High-density** as a rare upgrade after Standard is considered.
- **Fragmented**: use when the artifact explains one compact fragment: screenshot, post, short excerpt, table crop, chat snippet, or news flash. Use one title, 1-2 callouts, one dominant content area, and no footer.
- **Standard**: use when the artifact explains one update: one event, one company note, one recurring summary, one screenshot/post, one podcast/news summary, or one simple report. Default to portrait `1024x1536` with one thesis, three focused sections, one primary visual form per section, and one compact footer. Emphasize what changed, why it matters, and what to watch.
- **High-density**: use only when the artifact explains a system: multiple actors, timeline, causal chain, evidence layers, competing interpretations, or second-order consequences. Default to portrait `1024x1536` with one thesis and four focused sections; use five only when needed. High-density still needs breathing room: prefer selective compression, clear spacing, and focused modules over exhaustive coverage.
- Use landscape only when the user explicitly asks for a slide, deck page, horizontal layout, or provides a landscape reference.

**Step 2 — Plan the information structure**

Pick one organizing structure: signal map, comparison matrix, metric grid plus analysis, timeline, flow plus evidence panels, category grid, ranked rows, or another clear information-design form.

For standard marginal-update artifacts, make the visual hierarchy reflect the thesis first, evidence second, and implication/watchlist last.

Build a title tree:
- H1: short subject or core conclusion, not a full sentence with qualifiers
- Subtitle: date, scope, source, and important qualifiers
- Section headers: 3-5 strong takeaway labels; avoid generic labels such as "核心判断" unless the source truly lacks a sharper angle
- Lower-level content should become metric labels, ranked rows, chart annotations, table cells, or callouts, not extra headings

Choose visual forms:
- Use charts for comparable quantities, time series, distributions, shares, rankings, and before/after deltas.
- Charts should compare like with like. When metrics use different units or meanings, use separate mini charts, KPI rows, or annotated callouts.
- Do not force charts for mixed units, qualitative logic, disclaimers, isolated headline metrics, or causal arguments.
- Preserve data integrity: do not invent implied series, interpolation, or trend shapes. Use line charts, sparklines, area charts, or trend arrows only when the source provides explicit sequential data points. If the source gives only one current value plus YoY/MoM commentary, use metric tiles, tables, ranked rows, or annotated callouts instead.
- For every chart, specify chart type, axes, series, data values, legend, labels, and annotations.
- For non-chart sections, specify the exact form: metric cards, ranked rows, table, callout, flow nodes, timeline, funnel, comparison matrix, or signal map.

**Step 3 — Define the visual language**

Use a clean editorial information graphic style with Goldman Sachs-like visual clarity: white canvas, calm hierarchy, polished modular layout, soft color accents, text-and-data-led storytelling, and black/gray typography. Use soft accent colors to clarify groups, comparisons, and risk/positive signals. Orange `#C2410C` should be a recurring signature accent, not the sole theme color. It should feel modern, analytical, and readable across news summaries, research notes, screenshots, podcasts, and social-media explainers.

Charts and tables:
- Charts and tables should use source-provided values, clean axes, direct labels, restrained gridlines, compact labels, and no invented trends.
- Tables should be dense but readable, with subtle rules and light header treatment, not saturated table bands.

Layout and surfaces:
- Major sections should usually be separated by whitespace, thin horizontal rules, aligned headings, or column rhythm, not boxed module containers.
- Use cards only for repeated metric tiles, tables, or callouts. Do not nest bordered cards inside bordered modules.
- Avoid thick borders, heavy shadows, saturated table headers, oversized icons, decorative badges, and icon-led layouts.
- Use a text-and-data-led editorial layout: let headings, numbers, tables, thin rules, and annotations carry the information. Icons may appear as small rhythm accents for distinctive concepts, not as the primary structure.

Typography:
- Use a clear research-report hierarchy: large bold near-black H1, smaller muted subtitle, near-black section headers supported by thin Orange rules or small Orange markers, regular black/gray body text, and heavier key metrics or takeaways. Use Orange for hierarchy accents and selected emphasis, not as the dominant text color. Use normal-width Simplified Chinese sans-serif and wrap long headings instead of compressing glyphs.

**Step 4 — Write the English prompt**

Write a concise natural-language image prompt, not a technical color protocol. It should read like an artifact specification from the official examples.

Include:
- Artifact type, audience, canvas, quality, density mode, and core viewpoint
- Visible text in Simplified Chinese, preserving English terms when customary
- H1, subtitle, and 3-5 section headers
- Module-by-module visual forms with exact labels, values, annotations, and chart mechanics
- A short visual direction block covering palette mood, typography, layout surfaces, icons, and footer
- The visual direction block must explicitly include these style anchors: `clean editorial information graphic style`, `Goldman Sachs-like visual clarity`, `white canvas`, `calm hierarchy`, `soft color accents`, `Orange #C2410C as a recurring signature accent, not the sole theme color`, and `text-and-data-led storytelling`

Final prompt formatting:
- Do not use Markdown heading symbols inside the English image prompt. Write the title tree as plain labeled lines: `H1: ...`, `Subtitle: ...`, `Section 1 header: ...`.
- Use `Bold emphasis:` labels or natural language to mark key metrics and takeaways that should render larger/heavier; avoid passing literal Markdown characters such as `#`, `##`, or `**` to the image model.

Language rule:
- Common visible text, explanatory labels, titles, and disclaimers should be Simplified Chinese.
- Preserve professional abbreviations, ticker symbols, company/product names, units, and market-standard English terms when clearer or customary, such as Agent, RAG, LLM, CoT, NAND, DDR4, DDR5, HBM, LPDDR5, MLCC, ETF, Alpha, Beta, Quant, Backtesting, DeFi, Blockchain, NVDA, H100, H200, CUDA, and Codex.

Footer:
- Outside fragmented mode, include a small low-emphasis footer:

```text
数据来源：{source}
节选自：{document_or_topic}，不构成投资建议
```

- If source or document is unknown outside fragmented mode, ask the user before finalizing the prompt.

**Step 5 — Self-check before showing the user**

Revise the prompt until it passes:
- Clear analytical thesis; not a compressed article
- Canvas and density match the source and user request
- Short H1; subtitle carries scope and qualifiers
- Fragmented or Standard is the default; High-density appears only when the artifact explains a system rather than one update
- Standard mode uses three focused sections and one primary visual form per section by default; high-density uses 4 focused sections unless 5 is truly needed
- The final English prompt uses `H1:` and `Section header:` labels instead of Markdown heading symbols
- One organizing structure; no competing layout systems
- Every module has an explicit visual form; every chart has full mechanics and only uses source-provided data points
- Visual language is simple: clean editorial information graphic style with Goldman Sachs-like visual clarity, soft color accents, and Orange as a recurring signature accent, not the sole theme color
- Major sections are not boxed as nested cards
- The prompt uses a text-and-data-led editorial layout, with icons only as small rhythm accents for distinctive concepts
- High-density prompts preserve breathing room through selective compression instead of exhaustive coverage
- Text volume is plausible for the canvas
- Footer present outside fragmented mode

**Step 6 — Human approval**

Show the user two sections:
- `English prompt`: the exact prompt that will be used for image generation after approval
- `中文说明`: a Chinese review version for the user only; do not pass it to the image tool

Wait for approval or changes. If the user requests changes, revise from Step 4, run Step 5 again, and show both sections again.

**Step 7 — Generate only after approval**

- Use only the approved English prompt as image-generation input.
- Do not pass the Chinese explanation into the image-generation tool.
- Default to `gpt-image-2` when using the OpenAI Images API directly.
- Prefer `quality="high"` when the image contains small text, dense labels, charts, axes, legends, or footers.

## File Boundary

This skill excludes non-information-design content. Do not generate prompts for photography, logos, ads, UI mockups, product mockups, comics, style transfer, object removal, compositing, interior design, holiday cards, collectibles, or children's books.
