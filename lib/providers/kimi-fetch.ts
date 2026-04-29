const MOONSHOT_API_BASE = 'https://api.moonshot.cn/v1'
const KIMI_FETCH_FORMULA = 'moonshot/fetch:latest'

type FormulaToolsResponse = {
  tools?: Array<{
    type?: string
    function?: { name?: string }
  }>
}

type FormulaFiberResponse = {
  status?: string
  context?: {
    output?: string
    encrypted_output?: string
    error?: string
  }
  error?: unknown
}

export async function fetchUrlWithKimi(url: string): Promise<string> {
  const apiKey = process.env.MOONSHOT_API_KEY
  if (!apiKey) throw new Error('未配置 MOONSHOT_API_KEY')

  const functionName = await getKimiFetchFunctionName(apiKey)
  const output = await callKimiFetchFormula(apiKey, functionName, url)

  if (output.trim().length < 80) {
    throw new Error('Kimi fetch 返回正文过少；请改为粘贴正文，或上传 PDF/截图。')
  }

  return `URL: ${url}\n\n${output.slice(0, 12000)}`
}

async function getKimiFetchFunctionName(apiKey: string): Promise<string> {
  const res = await fetch(`${MOONSHOT_API_BASE}/formulas/${KIMI_FETCH_FORMULA}/tools`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Kimi fetch 工具列表获取失败（${res.status}）：${err.slice(0, 200)}`)
  }

  const data = await res.json() as FormulaToolsResponse
  const names = (data.tools ?? [])
    .filter((tool) => tool.type === 'function')
    .map((tool) => tool.function?.name)
    .filter((name): name is string => Boolean(name))

  return names.includes('fetch') ? 'fetch' : names[0] ?? failNoKimiFetchTool()
}

async function callKimiFetchFormula(
  apiKey: string,
  functionName: string,
  url: string,
): Promise<string> {
  const res = await fetch(`${MOONSHOT_API_BASE}/formulas/${KIMI_FETCH_FORMULA}/fibers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: functionName,
      arguments: JSON.stringify({ url }),
    }),
  })

  const data = await res.json() as FormulaFiberResponse
  if (!res.ok) {
    throw new Error(`Kimi fetch 执行失败（${res.status}）：${JSON.stringify(data).slice(0, 200)}`)
  }

  const context = data.context
  const output = context?.output ?? context?.encrypted_output ?? ''
  if (data.status !== 'succeeded' || context?.error || !output) {
    const error = context?.error ?? data.error ?? data
    throw new Error(`Kimi fetch 未返回可用正文：${JSON.stringify(error).slice(0, 300)}`)
  }

  return output
}

function failNoKimiFetchTool(): never {
  throw new Error('Kimi fetch 工具不可用')
}
