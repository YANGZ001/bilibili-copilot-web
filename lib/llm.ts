export interface LLMConfig {
  apiKey: string
  apiBase: string
  model: string
  chatEndpoint: string
}

export function getLLMConfig(): LLMConfig {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_COMPATIBLE_API_KEY || ''
  const apiBase = (
    process.env.DEEPSEEK_API_URL ||
    process.env.OPENAI_COMPATIBLE_BASE_URL ||
    'https://api.deepseek.com'
  ).replace(/\/+$/, '')
  const model = process.env.DEEPSEEK_MODEL || process.env.OPENAI_COMPATIBLE_MODEL || 'deepseek-chat'
  return { apiKey, apiBase, model, chatEndpoint: `${apiBase}/chat/completions` }
}
