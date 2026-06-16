export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GenerateRequest {
  messages: Message[]
  temperature?: number
  maxTokens?: number
}

export interface GenerateResult {
  provider: string
  content: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  finishReason: string
}

export interface GenerateChunk {
  provider: string
  delta: string
}

export interface LLMProvider {
  name: string
  generate(req: GenerateRequest): Promise<GenerateResult>
  stream(req: GenerateRequest): AsyncIterable<GenerateChunk>
}
