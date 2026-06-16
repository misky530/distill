import { ArkProvider } from './base'

export class DeepSeekProvider extends ArkProvider {
  constructor() {
    super('deepseek', process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-pro')
  }
}
