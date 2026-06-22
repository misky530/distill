import { NextRequest, NextResponse } from 'next/server'
import { LLMRouter } from '@/lib/llm-router'

const router = new LLMRouter()

interface ParsedContent {
  summary: string
  document: string
  mindmap: string
}

/**
 * 补偿算法：LLM不总是严格输出纯JSON，常见的"不听话"模式有：
 * 1. 用 ```json ... ``` 代码块包裹
 * 2. JSON前后夹带解释性文字（"好的，以下是结果：{...}"）
 * 3. 字符串内部出现未转义的换行符（合法的多行markdown内容）
 *
 * 这里依次尝试几种提取策略，而不是一次JSON.parse失败就直接放弃，
 * 只有所有策略都失败时才真正fallback成把原始文本塞进summary。
 */
function extractJsonContent(raw: string): ParsedContent | null {
  // 策略1：直接解析（理想情况）
  try {
    const parsed = JSON.parse(raw)
    if (parsed.summary !== undefined) return parsed
  } catch {
    // 继续尝试其他策略
  }

  // 策略2：剥离markdown代码块包裹 ```json ... ``` 或 ``` ... ```
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1])
      if (parsed.summary !== undefined) return parsed
    } catch {
      // 继续尝试
    }
  }

  // 策略3：提取第一个 { 到最后一个 } 之间的内容（应对前后有解释性文字的情况）
  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1))
      if (parsed.summary !== undefined) return parsed
    } catch {
      // 全部失败，交给调用方做最终fallback
    }
  }

  return null
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { transcript, plan } = body

  if (!transcript || typeof transcript !== 'string') {
    return NextResponse.json({ error: 'transcript is required' }, { status: 400 })
  }

  const messages = [
    {
      role: 'system' as const,
      content: `你是一个专业的学习助手。请根据以下视频转录文本，生成结构化知识输出。

严格按以下 JSON 格式输出，不要有任何其他内容，不要用markdown代码块包裹：
{
  "summary": "摘要，200字以内",
  "document": "结构化学习笔记，Markdown格式",
  "mindmap": "mindmap\n  root((主题))\n    子节点1\n    子节点2"
}`,
    },
    {
      role: 'user' as const,
      content: transcript,
    },
  ]

  try {
    if (plan === 'pro') {
      const result = await router.generateWithJudge({ messages })

      const content = extractJsonContent(result.winner.content) ?? {
        summary: result.winner.content,
        document: '',
        mindmap: '',
      }

      // loser的内容同样走JSON提取，保持和winner一致的解析逻辑，
      // 这样前端拿到的两份数据结构完全对称，不需要额外的兜底分支
      const loserContent = extractJsonContent(result.loser.content) ?? {
        summary: result.loser.content,
        document: '',
        mindmap: '',
      }

      return NextResponse.json({
        content,
        winner: result.winner.provider,
        loser: result.loser.provider,
        loserContent,
        scores: result.scores,
      })
    } else {
      const result = await router.generateFree({ messages })

      const content = extractJsonContent(result.content) ?? {
        summary: result.content,
        document: '',
        mindmap: '',
      }

      return NextResponse.json({ content })
    }
  } catch (err) {
    console.error('[generate]', err)
    return NextResponse.json({ error: 'generation failed' }, { status: 500 })
  }
}
