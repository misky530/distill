import { NextRequest, NextResponse } from 'next/server'
import { LLMRouter } from '@/lib/llm-router'

const router = new LLMRouter()

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

严格按以下 JSON 格式输出，不要有任何其他内容：
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

      let content
      try {
        content = JSON.parse(result.winner.content)
      } catch {
        content = { summary: result.winner.content, document: '', mindmap: '' }
      }

      return NextResponse.json({
        content,
        winner: result.winner.provider,
        scores: result.scores,
      })
    } else {
      const result = await router.generateFree({ messages })

      let content
      try {
        content = JSON.parse(result.content)
      } catch {
        content = { summary: result.content, document: '', mindmap: '' }
      }

      return NextResponse.json({ content })
    }
  } catch (err) {
    console.error('[generate]', err)
    return NextResponse.json({ error: 'generation failed' }, { status: 500 })
  }
}
