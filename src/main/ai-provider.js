import { OllamaProvider } from './providers/ollama.js'
import { OpenAICompatProvider } from './providers/openai-compat.js'
import { ClaudeProvider } from './providers/claude.js'

export function createProvider(config) {
  switch (config.provider) {
    case 'ollama':
      return new OllamaProvider(config.ollama)
    case 'openai':
      return new OpenAICompatProvider(config.openai)
    case 'claude':
      return new ClaudeProvider(config.claude)
    default:
      throw new Error(`Unknown provider: ${config.provider}`)
  }
}
