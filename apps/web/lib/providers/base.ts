import type { LLMProvider, GenerateRequest, GenerateResult, GenerateChunk } from './types'

export class ArkProvider implements LLMProvider {
  name: string
  private readonly model: string

  constructor(name: string, model: string) {
    // 注意：这里故意不在构造函数里校验 ARK_API_KEY 是否存在。
    // Next.js 在 `next build` 阶段会为了静态分析而实例化每个 API route 引用的模块，
    // 此时构建容器内通常还没有注入运行时的环境变量（它们是 docker-compose 在容器启动时才传入的），
    // 如果在构造函数里强制要求 apiKey 存在，会导致 build 直接失败。
    // 把校验推迟到真正调用 generate()/stream() 的时刻，构建期就不会受影响。
    this.name = name
    this.model = model
  }

  private getApiKey(): string {
    const apiKey = process.env.ARK_API_KEY ?? ''
    if (!apiKey) throw new Error('ARK_API_KEY is required')
    return apiKey
  }

  private getBaseURL(): string {
    return process.env.ARK_BASE_URL ?? 'https://ark.cn-beijing.volces.com/api/coding/v3'
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const res = await fetch(`${this.getBaseURL()}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        messages: req.messages,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens ?? 4096,
        stream: false,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`${this.name} API error ${res.status}: ${body}`)
    }

    const data = await res.json()
    const choice = data.choices[0]

    return {
      provider: this.name,
      content: choice.message.content,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      finishReason: choice.finish_reason,
    }
  }

  async *stream(req: GenerateRequest): AsyncIterable<GenerateChunk> {
    const res = await fetch(`${this.getBaseURL()}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        messages: req.messages,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens ?? 4096,
        stream: true,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`${this.name} stream error ${res.status}: ${body}`)
    }

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue

          try {
            const json = JSON.parse(trimmed.slice(6))
            const delta = json.choices[0]?.delta
            if (delta?.content) {
              yield { provider: this.name, delta: delta.content }
            }
          } catch {
            // skip malformed SSE line
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  private headers() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.getApiKey()}`,
    }
  }
}
