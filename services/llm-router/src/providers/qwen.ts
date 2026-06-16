import { ArkProvider } from './base'

export class QwenProvider extends ArkProvider {
  constructor() {
    super('qwen', process.env.QWEN_MODEL ?? 'kimi-k2.6')
  }
}
