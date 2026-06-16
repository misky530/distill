// services/llm-router/src/prompts/judge.ts
// LLM-as-judge prompt — model-agnostic, used by Doubao (default) or any pluggable judge

export function buildJudgePrompt(
  transcript: string,
  results: Array<{ provider: string; content: string }>,
): string {
  const candidates = results
    .map(
      (r, i) =>
        `### Candidate ${i + 1} (${r.provider})\n${r.content}`,
    )
    .join('\n\n')

  return `You are an expert evaluator assessing AI-generated study notes derived from a video transcript.

## Source Transcript (first 2000 chars)
${transcript.slice(0, 2000)}${transcript.length > 2000 ? '\n[truncated]' : ''}

## Candidates to Evaluate
${candidates}

## Scoring Instructions
Score each candidate on THREE dimensions (1–5 integer each):
- **coverage**: Does it capture the key points from the transcript?
- **structure**: Is it logically organised and easy to review?
- **factuality**: Is it consistent with the source? No hallucinations?

## Output Format
Respond ONLY with valid JSON. No markdown fences, no preamble.

{
  "scores": [
    {
      "provider": "<provider_name>",
      "coverage": <1-5>,
      "structure": <1-5>,
      "factuality": <1-5>,
      "reasoning": "<one sentence explaining this score>"
    }
  ],
  "winner": "<provider_name with highest weighted average>",
  "summary": "<one sentence comparing the candidates>"
}

Weights: coverage 40%, structure 30%, factuality 30%.
The winner must be the provider with the highest weighted total.`
}
