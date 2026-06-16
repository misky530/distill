import { ArkProvider } from './base'

export class DoubaoProvider extends ArkProvider {
  constructor() {
    super('doubao', process.env.DOUBAO_MODEL ?? 'doubao-seed-2.0-pro')
  }
}
