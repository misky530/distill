// services/llm-router/src/router.ts
// Parallel generation + LLM-as-judge arbitration

import type {
  GenerateRequest,
  GenerateResult,
  JudgeResult,
  LLMProvider,
  ModelPlan,
} from './providers/types'

/**
 * Route to providers based on user plan.
 * free  → DeepSeek only (cost-efficient)
 * pro   → DeepSeek + Qwen in parallel, judge picks winner
 */
export function resolveProviders(
  plan: ModelPlan,
  registry: Map<string, LLMProvider>,
): LLMProvider[] {
  if (plan === 'pro') {
    return ['deepseek', 'qwen']
      .map((name) => registry.get(name))
      .filter(Boolean) as LLMProvider[]
  }
  const free = registry.get('deepseek')
  return free ? [free] : []
}

/**
 * Run all providers in parallel.
 * If one fails, the others still complete — partial results are valid.
 */
export async function generateParallel(
  providers: LLMProvider[],
  req: GenerateRequest,
): Promise<GenerateResult[]> {
  const settled = await Promise.allSettled(
    providers.map((p) => p.generate(req)),
  )

  return settled
    .filter((r): r is PromiseFulfilledResult<GenerateResult> => r.status === 'fulfilled')
    .map((r) => r.value)
}

/**
 * Full pipeline:
 * 1. Resolve providers by plan
 * 2. Generate in parallel
 * 3. If multiple results, run judge
 * 4. Return results + optional judge verdict
 */
export async function run(
  req: GenerateRequest,
  registry: Map<string, LLMProvider>,
  judge: (results: GenerateResult[], transcript: string) => Promise<JudgeResult>,
): Promise<{ results: GenerateResult[]; judgment?: JudgeResult }> {
  const plan = req.plan ?? 'free'
  const providers = resolveProviders(plan, registry)

  if (providers.length === 0) {
    throw new Error('No providers available for plan: ' + plan)
  }

  const results = await generateParallel(providers, req)

  if (results.length === 0) {
    throw new Error('All providers failed')
  }

  // Only judge when there are multiple results to compare
  if (results.length > 1) {
    const judgment = await judge(results, req.transcript)
    return { results, judgment }
  }

  return { results }
}
