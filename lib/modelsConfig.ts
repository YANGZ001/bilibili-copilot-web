import modelsConfig from '@/config/models.json'

// Single source of truth for which transcript models are supported.
// rpm/rpd are stored for future rate-limit enforcement (not enforced yet).

export interface RateLimit {
  rpm: number
  rpd: number
}

export interface ModelsConfig {
  default: RateLimit
  models: Record<string, RateLimit>
}

const config = modelsConfig as ModelsConfig

// Model ids in config order; the first entry is the default selection.
export function getModelIds(): string[] {
  return Object.keys(config.models)
}

export function isAllowedModel(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(config.models, id)
}

export { config as modelsConfig }
