import { LLMRouter } from './src/router'

const router = new LLMRouter()

const req = {
  messages: [
    { role: 'user' as const, content: '用一句话总结：机器学习是什么？' }
  ]
}

console.log('--- free tier (DeepSeek only) ---')
const free = await router.generateFree(req)
console.log(free.content)

console.log('\n--- pro tier (parallel + judge) ---')
const result = await router.generateWithJudge(req)
console.log('winner:', result.winner.provider)
console.log('scores:', JSON.stringify(result.scores, null, 2))
console.log(result.winner.content)
