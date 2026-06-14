// ============================================
// TURBO MODE - OpenRouter Gateway — Un solo key, todos los modelos
// ============================================

export interface TurboModel {
  id: string           // ID en OpenRouter (ej: openai/gpt-5.4)
  name: string         // Nombre visible
  provider: string     // Nombre del proveedor original
  providerIcon: string // Emoji del proveedor
  description: string
  tier: 'fast' | 'pro' | 'ultra'
  contextWindow: string
  supportsVision: boolean
}

// Modelos top actuales disponibles en OpenRouter (Marzo 2026)
export const TURBO_MODELS: TurboModel[] = [
  // 🟢 OpenAI
  {
    id: 'openai/gpt-5.4',
    name: 'GPT-5.4',
    provider: 'OpenAI',
    providerIcon: '🟢',
    description: 'El más inteligente de OpenAI — 1M contexto, razonamiento unificado',
    tier: 'ultra',
    contextWindow: '1M',
    supportsVision: true,
  },
  {
    id: 'openai/gpt-5.4-mini',
    name: 'GPT-5.4 Mini',
    provider: 'OpenAI',
    providerIcon: '🟢',
    description: 'Rápido y potente, excelente razonamiento',
    tier: 'pro',
    contextWindow: '400K',
    supportsVision: true,
  },
  {
    id: 'openai/o3',
    name: 'o3',
    provider: 'OpenAI',
    providerIcon: '🟢',
    description: 'Máximo razonamiento paso a paso',
    tier: 'ultra',
    contextWindow: '200K',
    supportsVision: true,
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    providerIcon: '🟢',
    description: 'Rápido, económico, multimodal',
    tier: 'fast',
    contextWindow: '128K',
    supportsVision: true,
  },
  // 🟠 Anthropic
  {
    id: 'anthropic/claude-fable-5',
    name: 'Claude Fable 5',
    provider: 'Anthropic',
    providerIcon: '🟠',
    description: 'El más poderoso de Anthropic — razonamiento y código de última generación',
    tier: 'ultra',
    contextWindow: '1M',
    supportsVision: true,
  },
  {
    id: 'anthropic/claude-opus-4.8',
    name: 'Claude Opus 4.8',
    provider: 'Anthropic',
    providerIcon: '🟠',
    description: 'Máxima inteligencia Anthropic — 1M contexto, 200K output',
    tier: 'ultra',
    contextWindow: '1M',
    supportsVision: true,
  },
  {
    id: 'anthropic/claude-opus-4.6',
    name: 'Claude Opus 4.6',
    provider: 'Anthropic',
    providerIcon: '🟠',
    description: 'Alta inteligencia Anthropic — 1M contexto',
    tier: 'ultra',
    contextWindow: '1M',
    supportsVision: true,
  },
  {
    id: 'anthropic/claude-sonnet-4.6',
    name: 'Claude Sonnet 4.6',
    provider: 'Anthropic',
    providerIcon: '🟠',
    description: 'Equilibrio perfecto velocidad/calidad',
    tier: 'pro',
    contextWindow: '1M',
    supportsVision: true,
  },
  // 🔵 Google
  {
    id: 'google/gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    provider: 'Google',
    providerIcon: '🔵',
    description: 'Lo mejor de Google — razonamiento avanzado',
    tier: 'ultra',
    contextWindow: '1M',
    supportsVision: true,
  },
  {
    id: 'google/gemini-3-flash-preview',
    name: 'Gemini 3 Flash',
    provider: 'Google',
    providerIcon: '🔵',
    description: 'Ultra rápido, razonamiento near-Pro',
    tier: 'fast',
    contextWindow: '1M',
    supportsVision: true,
  },
  // 🔴 Otros top
  {
    id: 'deepseek/deepseek-chat-v3-0324',
    name: 'DeepSeek V3.2',
    provider: 'DeepSeek',
    providerIcon: '🔴',
    description: 'Rendimiento frontier a fracción del costo',
    tier: 'pro',
    contextWindow: '128K',
    supportsVision: false,
  },
  {
    id: 'x-ai/grok-4.1-fast',
    name: 'Grok 4.1 Fast',
    provider: 'xAI',
    providerIcon: '⚪',
    description: 'Contexto masivo 2M tokens, ultra rápido',
    tier: 'fast',
    contextWindow: '2M',
    supportsVision: true,
  },
  // 🌙 Moonshot AI (Kimi)
  {
    id: 'moonshotai/kimi-k2-thinking',
    name: 'Kimi K2 Thinking',
    provider: 'Moonshot AI',
    providerIcon: '🌙',
    description: 'Razonamiento agentic avanzado — 131K contexto, MoE 32B params',
    tier: 'pro',
    contextWindow: '131K',
    supportsVision: false,
  },
  {
    id: 'moonshotai/kimi-k2.5',
    name: 'Kimi K2.5',
    provider: 'Moonshot AI',
    providerIcon: '🌙',
    description: 'Multimodal con visual coding — 262K contexto, agent swarm',
    tier: 'pro',
    contextWindow: '262K',
    supportsVision: true,
  },
]

// Special auto-select ID
export const TURBO_AUTO_SELECT_ID = 'auto_best'

// Intelligence ranking for auto-select (higher = smarter)
// Based on benchmarks and real-world performance
const MODEL_INTELLIGENCE_RANK: Record<string, number> = {
  'openai/gpt-5.4': 98,
  'anthropic/claude-opus-4.6': 97,
  'google/gemini-3.1-pro-preview': 95,
  'openai/o3': 94,
  'moonshotai/kimi-k2.5': 91,
  'anthropic/claude-sonnet-4.6': 90,
  'moonshotai/kimi-k2-thinking': 89,
  'deepseek/deepseek-v3.2': 87,
  'openai/gpt-5.4-mini': 85,
  'x-ai/grok-4.1-fast': 83,
  'google/gemini-3-flash-preview': 80,
  'openai/gpt-4o': 75,
}

// Cost efficiency ranking (higher = better value for performance)
const MODEL_EFFICIENCY_RANK: Record<string, number> = {
  'moonshotai/kimi-k2.5': 98,       // $0.38/M in, top performance
  'moonshotai/kimi-k2-thinking': 96, // $0.47/M in, great reasoning
  'deepseek/deepseek-v3.2': 95,     // Very cheap, frontier perf
  'google/gemini-3-flash-preview': 93,
  'openai/gpt-4o': 88,
  'openai/gpt-5.4-mini': 85,
  'anthropic/claude-sonnet-4.6': 78,
  'x-ai/grok-4.1-fast': 75,
  'google/gemini-3.1-pro-preview': 70,
  'openai/o3': 60,
  'anthropic/claude-opus-4.6': 55,
  'openai/gpt-5.4': 50,
}

export type AutoSelectStrategy = 'smartest' | 'efficient' | 'balanced'

/**
 * Auto-select the best model based on strategy
 * - smartest: Pick the highest intelligence model
 * - efficient: Pick the best performance/cost ratio
 * - balanced: Weighted mix of both (default)
 */
export function autoSelectBestModel(strategy: AutoSelectStrategy = 'balanced'): TurboModel {
  const ranked = TURBO_MODELS.map(m => {
    const intelligence = MODEL_INTELLIGENCE_RANK[m.id] || 50
    const efficiency = MODEL_EFFICIENCY_RANK[m.id] || 50
    
    let score: number
    switch (strategy) {
      case 'smartest': score = intelligence; break
      case 'efficient': score = efficiency; break
      case 'balanced': 
      default: score = intelligence * 0.6 + efficiency * 0.4; break
    }
    
    return { model: m, score }
  }).sort((a, b) => b.score - a.score)
  
  return ranked[0].model
}

export function getModelById(modelId: string): TurboModel | undefined {
  return TURBO_MODELS.find(m => m.id === modelId)
}

export function getTierBadge(tier: string): { label: string; color: string; bg: string } {
  switch (tier) {
    case 'ultra': return { label: '⚡ ULTRA', color: 'text-amber-400', bg: 'bg-amber-400/15' }
    case 'pro': return { label: '🔥 PRO', color: 'text-purple-400', bg: 'bg-purple-400/15' }
    default: return { label: '⚠ FAST', color: 'text-emerald-400', bg: 'bg-emerald-400/15' }
  }
}

// OpenRouter base URL
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
