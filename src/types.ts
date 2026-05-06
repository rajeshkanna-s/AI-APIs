export type AiModel = {
  id: string
  priority: number
  name: string
  provider: string
  active: boolean
  max_tokens_limit: number
  notes: string | null
}

export type TokenSlot = {
  id: string
  priority: number
  display_name: string
  secret_name: string
  provider: string
  active: boolean
}

export type ProviderUrl = {
  id: string
  provider: string
  chat_completions_url: string
  active: boolean
}

export type ChatResult = {
  provider?: string
  model?: string
  tokenSlot?: string
  content?: string
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  } | null
  error?: string
  providerStatus?: number
  fallback?: {
    attempted: number
    latencyMs?: number
    attemptTimeoutMs?: number
    switchedModel?: boolean
    switchedToken?: boolean
    attempts: Array<{
      model: string
      tokenSlot: string
      status: number | string
      reason: 'token' | 'model' | 'provider' | 'network'
      error: string
    }>
  }
}

export type CustomApiBuildResult = {
  name: string
  slug: string
  apiUrl: string
  accessToken: string
  curl: string
  limits: {
    tokens: number
    models: number
    maxLoops: number
  }
  error?: string
}
