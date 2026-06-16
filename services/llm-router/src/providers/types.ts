// services/llm-router/src/providers/types.ts
// Shared provider interface — judge and generators implement the same contract

export type Scene = 'summary' | 'document' | 'mindmap'

export type ModelPlan = 'free' | 'pro'

export interface GenerateRequest {
  transcript: string
  scene: Scene
  plan?: ModelPlan
}

export interface GenerateChunk {
  provider: string
  delta: string
  done: boolean
}

export interface GenerateResult {
  provider: string
  content: string
  latencyMs: number
  inputTokens?: number
  outputTokens?: number
}

// LLM-as-judge score from the arbitration model (Doubao by default)
export interface JudgeScore {
  provider: string         // which generator is being scored
  coverage: number         // 1-5: how well it covers the transcript
  structure: number        // 1-5: logical organisation
  factuality: number       // 1-5: consistency with source transcript
  total: number            // weighted average
  reasoning: string        // judge's explanation (1-2 sentences)
}

export interface JudgeResult {
  scores: JudgeScore[]
  winner: string           // provider name with highest total
  judgedBy: string         // which model acted as judge
  latencyMs: number
}

// Every LLM provider must implement this interface
export interface LLMProvider {
  name: string
  generate(req: GenerateRequest): Promise<GenerateResult>
  stream(req: GenerateRequest): AsyncIterable<GenerateChunk>
}
