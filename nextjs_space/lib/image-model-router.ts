/**
 * Image Model Router — Sprint 12: Multi-Model Image Generation Engine
 * Detects user intent from natural language and routes to the optimal image model.
 * Reuses the shared IMAGE_MODELS catalog from lib/image-models.ts.
 */

import { IMAGE_MODELS, getImageModel, type ImageModel } from './image-models'

// ═══════════════════════════════════════════════════════════════════════════════
// Model Aliases — Maps natural language names to actual model IDs
// ═══════════════════════════════════════════════════════════════════════════════
export const MODEL_ALIASES: Record<string, string> = {
  // GPT / OpenAI
  'gpt-image-1': 'openai/gpt-5.4-image-2',
  'gpt-image': 'openai/gpt-5.4-image-2',
  'gpt image': 'openai/gpt-5.4-image-2',
  'gpt': 'openai/gpt-5.4-image-2',
  'openai': 'openai/gpt-5.4-image-2',
  'dall-e': 'openai/gpt-5.4-image-2',
  'dalle': 'openai/gpt-5.4-image-2',
  'fotorrealista': 'openai/gpt-5.4-image-2',
  'photorealistic': 'openai/gpt-5.4-image-2',

  // Nano Banana (Gemini)
  'nano banana pro': 'google/gemini-3-pro-image-preview',
  'nano banana': 'google/gemini-3-pro-image-preview',
  'nano pro': 'google/gemini-3-pro-image-preview',
  'nano': 'google/gemini-3-pro-image-preview',
  'banana': 'google/gemini-3-pro-image-preview',
  'gemini': 'google/gemini-3-pro-image-preview',
  'gemini pro': 'google/gemini-3-pro-image-preview',
  'gemini flash': 'google/gemini-3.1-flash-image-preview',

  // Flux
  'flux kontext': 'black-forest-labs/flux.2-max',
  'flux max': 'black-forest-labs/flux.2-max',
  'flux': 'black-forest-labs/flux.2-max',
  'flux fast': 'black-forest-labs/flux.2-klein-4b',
  'flux klein': 'black-forest-labs/flux.2-klein-4b',

  // Ideogram → Riverflow (best for text in images)
  'ideogram': 'sourceful/riverflow-v2-pro',
  'ideograma': 'sourceful/riverflow-v2-pro',
  'riverflow': 'sourceful/riverflow-v2-pro',
  'riverflow pro': 'sourceful/riverflow-v2-pro',
  'riverflow fast': 'sourceful/riverflow-v2-fast',
  'texto en imagen': 'sourceful/riverflow-v2-pro',
  'text in image': 'sourceful/riverflow-v2-pro',

  // Recraft → Seedream (design-oriented)
  'recraft': 'bytedance-seed/seedream-4.5',
  'seedream': 'bytedance-seed/seedream-4.5',
  'vector': 'bytedance-seed/seedream-4.5',
  'diseño': 'bytedance-seed/seedream-4.5',
  'ui': 'bytedance-seed/seedream-4.5',
}

// Default model for image generation
export const DEFAULT_IMAGE_GEN_MODEL = 'openai/gpt-5.4-image-2'

// ═══════════════════════════════════════════════════════════════════════════════
// Fallback Chain — If a model fails, try the next one
// ═══════════════════════════════════════════════════════════════════════════════
export const FALLBACK_CHAIN: string[] = [
  'openai/gpt-5.4-image-2',
  'google/gemini-3-pro-image-preview',
  'black-forest-labs/flux.2-max',
  'sourceful/riverflow-v2-pro',
  'bytedance-seed/seedream-4.5',
  'default', // RouteLLM ultimate fallback
]

// ═══════════════════════════════════════════════════════════════════════════════
// Intent Detection — Image generation triggers
// ═══════════════════════════════════════════════════════════════════════════════
const IMAGE_GEN_TRIGGERS_ES = [
  /genera(?:r)?\s+(?:una?\s+)?imagen/i,
  /crea(?:r)?\s+(?:una?\s+)?imagen/i,
  /diseña(?:r)?\s+(?:una?\s+)?imagen/i,
  /genera(?:r)?\s+(?:una?\s+)?foto/i,
  /genera(?:r)?\s+(?:una?\s+)?ilustraci[oó]n/i,
  /genera(?:r)?\s+(?:el|la|un|una)\s+logo/i,
  /crea(?:r)?\s+(?:el|la|un|una)\s+logo/i,
  /genera(?:r)?\s+(?:un|una)\s+banner/i,
  /genera(?:r)?\s+(?:un|una)\s+ic[oó]no/i,
  /genera(?:r)?\s+(?:un|una)\s+vector/i,
  /genera(?:r)?\s+(?:un|una)\s+cartel/i,
  /genera(?:r)?\s+(?:un|una)\s+poster/i,
  /genera(?:r)?\s+(?:un|una)\s+portada/i,
  /genera(?:r)?\s+(?:[0-9]+)\s+(?:fotos?|im[aá]gen(?:es)?|ilustracion(?:es)?)/i,
  /(?:usa|utiliza|con)\s+(?:gpt|nano|flux|ideogram|recraft|riverflow|seedream|gemini|dall-?e|openai)/i,
]

const IMAGE_GEN_TRIGGERS_EN = [
  /generate\s+(?:an?\s+)?image/i,
  /create\s+(?:an?\s+)?image/i,
  /design\s+(?:an?\s+)?image/i,
  /generate\s+(?:an?\s+)?photo/i,
  /generate\s+(?:an?\s+)?illustration/i,
  /generate\s+(?:a\s+)?logo/i,
  /create\s+(?:a\s+)?logo/i,
  /generate\s+(?:a\s+)?banner/i,
  /generate\s+(?:an?\s+)?icon/i,
  /generate\s+(?:a\s+)?vector/i,
  /generate\s+(?:a\s+)?poster/i,
  /generate\s+(?:a\s+)?cover/i,
  /generate\s+(?:[0-9]+)\s+(?:photos?|images?|illustrations?)/i,
  /(?:use|with)\s+(?:gpt|nano|flux|ideogram|recraft|riverflow|seedream|gemini|dall-?e|openai)/i,
]

// ═══════════════════════════════════════════════════════════════════════════════
// Content-Type Detection — Auto-select model based on content type
// ═══════════════════════════════════════════════════════════════════════════════
const CONTENT_TYPE_PATTERNS: Array<{ patterns: RegExp[]; modelId: string; reason: string }> = [
  {
    patterns: [
      /logo\b/i, /logotipo/i, /texto.*(en|dentro|sobre).*imagen/i,
      /cartel\b/i, /men[uú]\b/i, /poster\b/i, /tipograf[ií]a/i,
      /lettering/i, /text.*(in|on|inside).*image/i,
    ],
    modelId: 'sourceful/riverflow-v2-pro',
    reason: 'text-in-image specialist',
  },
  {
    patterns: [
      /vector\b/i, /svg\b/i, /ui\/?ux/i, /interfaz/i, /wireframe/i,
      /mockup/i, /icon\b/i, /ic[oó]no/i, /flat\s*design/i,
    ],
    modelId: 'bytedance-seed/seedream-4.5',
    reason: 'design/vector specialist',
  },
  {
    patterns: [
      /editorial/i, /branding/i, /brand/i, /marca\b/i,
      /revist[ao]/i, /magazine/i, /portada/i, /cover\b/i,
    ],
    modelId: 'black-forest-labs/flux.2-max',
    reason: 'editorial/branding specialist',
  },
  {
    patterns: [
      /fotorreal/i, /photorreal/i, /hyperreal/i, /hiperrreal/i,
      /foto(?:graf[ií]a)?\s+(?:de|profesional)/i, /product\s*photo/i,
      /professional\s*photo/i, /studio\s*(?:shot|photo|lighting)/i,
    ],
    modelId: 'openai/gpt-5.4-image-2',
    reason: 'photorealistic specialist',
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect if a user message contains image generation intent
 */
export function detectImageGenIntent(message: string): boolean {
  const allTriggers = [...IMAGE_GEN_TRIGGERS_ES, ...IMAGE_GEN_TRIGGERS_EN]
  return allTriggers.some(rx => rx.test(message))
}

/**
 * Resolve model from user's natural language message.
 * Priority: 1. Explicit model name → 2. Content-type auto-detect → 3. Default
 */
export function resolveModelFromMessage(message: string): { modelId: string; reason: string; model: ImageModel | undefined } {
  const lower = message.toLowerCase()

  // 1. Check explicit model aliases (longest match first)
  const sortedAliases = Object.entries(MODEL_ALIASES).sort((a, b) => b[0].length - a[0].length)
  for (const [alias, modelId] of sortedAliases) {
    if (lower.includes(alias)) {
      return { modelId, reason: `explicit: "${alias}"`, model: getImageModel(modelId) }
    }
  }

  // 2. Check content-type patterns
  for (const ct of CONTENT_TYPE_PATTERNS) {
    for (const pattern of ct.patterns) {
      if (pattern.test(message)) {
        return { modelId: ct.modelId, reason: ct.reason, model: getImageModel(ct.modelId) }
      }
    }
  }

  // 3. Default
  return { modelId: DEFAULT_IMAGE_GEN_MODEL, reason: 'default (highest quality)', model: getImageModel(DEFAULT_IMAGE_GEN_MODEL) }
}

/**
 * Get the next fallback model after a failure
 */
export function getNextFallback(failedModelId: string): string | null {
  const idx = FALLBACK_CHAIN.indexOf(failedModelId)
  if (idx === -1 || idx >= FALLBACK_CHAIN.length - 1) return null
  return FALLBACK_CHAIN[idx + 1]
}

/**
 * Get display info for a model (emoji + name)
 */
export function getModelDisplayName(modelId: string): string {
  const model = getImageModel(modelId)
  if (model) return `${model.emoji} ${modelId.split('/').pop() || modelId}`
  if (modelId === 'default') return '🤖 RouteLLM'
  return modelId
}

/**
 * Get all available models for display
 */
export function getAvailableModels(): Array<{ id: string; name: string; emoji: string; needsKey: boolean }> {
  return IMAGE_MODELS.filter(m => m.id !== 'default').map(m => ({
    id: m.id,
    name: m.id.split('/').pop() || m.id,
    emoji: m.emoji,
    needsKey: m.needsKey,
  }))
}
