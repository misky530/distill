import { ArkProvider } from './providers/base'
import type { GenerateRequest, GenerateResult } from './providers/types'

export interface JudgeScore {
  coverage: number
  structure: number
  factuality: number
  total: number
  reasoning: string
}

export interface RouterResult {
  winner: GenerateResult
  loser: GenerateResult
  scores: Record<string, JudgeScore>
}

const JUDGE_PROMPT = (a: GenerateResult, b: GenerateResult) => `
You are an objective judge evaluating two AI-generated summaries of the same video transcript.

## Output A (${a.provider})
${a.content}

## Output B (${b.provider})
${b.content}

Score each output on three dimensions (0-10):
- Coverage (40%): key points captured from the source
- Structure (30%): logical organisation, reviewability
- Factuality (30%): consistency with source, no hallucination

Respond ONLY with valid JSON:
{
  "${a.provider}": { "coverage": 0, "structure": 0, "factuality": 0, "reasoning": "" },
  "${b.provider}": { "coverage": 0, "structure": 0, "factuality": 0, "reasoning": "" }
}
`.trim()

function weighted(s: Omit<JudgeScore, 'total' | 'reasoning'>): number {
  return s.coverage * 0.4 + s.structure * 0.3 + s.factuality * 0.3
}

export class LLMRouter {
  private deepseek = new ArkProvider('deepseek', process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-pro')
  private kimi = new ArkProvider('kimi', process.env.KIMI_MODEL ?? 'kimi-k2.6')
  private judge = new ArkProvider('doubao', process.env.DOUBAO_MODEL ?? 'doubao-seed-2.0-pro')

  async generateWithJudge(req: GenerateRequest): Promise<RouterResult> {
    const [a, b] = await Promise.all([
      this.deepseek.generate(req),
      this.kimi.generate(req),
    ])

    const judgeRes = await this.judge.generate({
      messages: [{ role: 'user', content: JUDGE_PROMPT(a, b) }],
      temperature: 0.1,
    })

    let raw: Record<string, { coverage: number; structure: number; factuality: number; reasoning: string }>
    try {
      raw = JSON.parse(judgeRes.content)
    } catch {
      const winner = a.content.length >= b.content.length ? a : b
      const loser = winner === a ? b : a
      return { winner, loser, scores: {} }
    }

    const scores: Record<string, JudgeScore> = {}
    for (const [provider, s] of Object.entries(raw)) {
      scores[provider] = { ...s, total: weighted(s) }
    }

    const aScore = scores[a.provider]?.total ?? 0
    const bScore = scores[b.provider]?.total ?? 0
    const [winner, loser] = aScore >= bScore ? [a, b] : [b, a]

    return { winner, loser, scores }
  }

  async generateFree(req: GenerateRequest): Promise<GenerateResult> {
    return this.deepseek.generate(req)
  }
}
