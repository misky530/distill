# LLM Router — Multi-Model Generation with LLM-as-Judge

> Built during the FutureAI Global Hackathon 2026 (v3)

## What it does

The LLM Router is the core service powering Distill's multi-model generation pipeline:

1. **Parallel generation** — DeepSeek and Qwen run simultaneously on the same transcript
2. **LLM-as-judge arbitration** — Doubao evaluates both outputs and picks the winner
3. **Per-plan routing** — free tier uses DeepSeek only; pro tier gets parallel + judge
4. **SSE streaming** — results stream to the browser as they arrive

```
User request
     │
     ▼
  Router
  ├── DeepSeek ──┐
  └── Qwen ──────┤──► Judge (Doubao) ──► Winner + scores
                 │
                 └──► SSE stream to browser
```

## Why a separate judge model?

Using the same model family to judge its own outputs introduces **self-preference bias** — models tend to rate outputs similar to their own training distribution more favourably. By using Doubao (a third-party model) as the judge, we get more objective arbitration.

## Provider interface

Every LLM provider implements the same `LLMProvider` interface (`src/providers/types.ts`):

```typescript
interface LLMProvider {
  name: string
  generate(req: GenerateRequest): Promise<GenerateResult>
  stream(req: GenerateRequest): AsyncIterable<GenerateChunk>
}
```

The judge model is **pluggable** — swap Doubao for Claude or any other model by changing one config value.

## Scoring dimensions

| Dimension   | Weight | Description                              |
|-------------|--------|------------------------------------------|
| Coverage    | 40%    | Key points captured from transcript      |
| Structure   | 30%    | Logical organisation, reviewability      |
| Factuality  | 30%    | Consistency with source, no hallucination|

## Running locally

```bash
cp ../../.env.example ../../.env
# fill in DEEPSEEK_API_KEY, QWEN_API_KEY, DOUBAO_API_KEY

pnpm install
pnpm dev
```
