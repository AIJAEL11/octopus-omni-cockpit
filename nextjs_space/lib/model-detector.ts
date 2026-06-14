/**
 * OCTOPUS — Image Model Detector
 * 
 * Detecta automáticamente si el usuario está pidiendo un modelo específico
 * en su mensaje ("usa nano banana", "con GPT-5.4", "genera con flux", etc).
 * 
 * Devuelve el modelId compatible con lib/image-models.ts o null si no hay mención.
 * 
 * Uso:
 *   const detected = detectImageModelFromMessage("genera una imagen con gpt 5.4")
 *   // → 'openai/gpt-5.4-image-2'
 */

import { IMAGE_MODELS, DEFAULT_IMAGE_MODEL_ID } from './image-models'

// Patrones de detección ordenados por especificidad (los más específicos primero)
// Cada patrón mapea a un modelId del catálogo.
// `highConfidence: true` = el nombre es único e inequívoco (marca registrada tipo
// "Nano Banana" o "GPT-5.4"), se detecta sin requerir palabra de contexto como
// "imagen" o "genera". `highConfidence: false` = nombres ambiguos que SÍ requieren
// contexto (ej. "flux" podría ser "flujo de caja").
const MODEL_PATTERNS: Array<{ regex: RegExp; modelId: string; label: string; highConfidence: boolean }> = [
  // ── OpenAI GPT Image 2 ── (high-confidence: "gpt-5" nunca aparece fuera de modelos)
  {
    regex: /\b(gpt[\s\-]?5(\.[0-9]+)?(\s+image)?|gpt[\s\-]?image|openai[\s\-]?image|chatgpt[\s\-]?image)\b/i,
    modelId: 'openai/gpt-5.4-image-2',
    label: 'GPT-5.4 Image 2',
    highConfidence: true,
  },

  // ── Nano Banana variants (Gemini 3 / 3.1) ──
  // Fast/Flash version FIRST (more specific than generic "nano banana")
  {
    regex: /\b(nano[\s\-]?banana[\s\-]?(fast|flash|2\.5|lite)|gemini[\s\-]?3\.1|gemini[\s\-]?flash[\s\-]?image)\b/i,
    modelId: 'google/gemini-3.1-flash-image-preview',
    label: 'Nano Banana Fast',
    highConfidence: true,
  },
  {
    regex: /\b(nano[\s\-]?banana(\s+pro)?|gemini[\s\-]?3[\s\-]?pro[\s\-]?image|gemini[\s\-]?pro[\s\-]?image)\b/i,
    modelId: 'google/gemini-3-pro-image-preview',
    label: 'Nano Banana Pro',
    highConfidence: true,
  },
  // Gemini 2.5 Flash (mención genérica a gemini 2.5)
  {
    regex: /\bgemini[\s\-]?2(\.[0-9]+)?[\s\-]?flash\b/i,
    modelId: 'google/gemini-2.5-flash-image-preview',
    label: 'Gemini 2.5 Flash',
    highConfidence: true,
  },
  // Gemini genérico → Pro (requiere contexto, "gemini" podría ser tarea de ML)
  {
    regex: /\bgemini\b/i,
    modelId: 'google/gemini-3-pro-image-preview',
    label: 'Gemini 3 Pro',
    highConfidence: false,
  },

  // ── FLUX variants ──
  {
    regex: /\b(flux[\s\-]?\.?2?[\s\-]?klein|flux[\s\-]?4b|flux[\s\-]?(fast|lite|small))\b/i,
    modelId: 'black-forest-labs/flux.2-klein-4b',
    label: 'FLUX.2 Klein',
    highConfidence: true,
  },
  // "flux.2" o "flux 2" con/sin max/pro/ultra — alta confianza (nombre específico)
  {
    regex: /\bflux[\s\-]?\.?\s?2([\s\-]?(max|pro|ultra))?\b/i,
    modelId: 'black-forest-labs/flux.2-max',
    label: 'FLUX.2 Max',
    highConfidence: true,
  },
  // Sólo "flux" sin versión — requiere contexto (podría ser "flujo")
  {
    regex: /\bflux\b/i,
    modelId: 'black-forest-labs/flux.2-max',
    label: 'FLUX.2 Max',
    highConfidence: false,
  },
  {
    regex: /\b(black[\s\-]?forest|forest[\s\-]?labs)\b/i,
    modelId: 'black-forest-labs/flux.2-max',
    label: 'FLUX.2 Max',
    highConfidence: true,
  },

  // ── Riverflow V2 (Sourceful) ──
  {
    regex: /\b(riverflow[\s\-]?(fast|lite)|sourceful[\s\-]?(fast|lite))\b/i,
    modelId: 'sourceful/riverflow-v2-fast',
    label: 'Riverflow V2 Fast',
    highConfidence: true,
  },
  {
    regex: /\b(riverflow(\s+pro)?|sourceful(\s+pro)?)\b/i,
    modelId: 'sourceful/riverflow-v2-pro',
    label: 'Riverflow V2 Pro',
    highConfidence: true,
  },

  // ── Seedream 4.5 (ByteDance) ──
  {
    regex: /\b(seedream|bytedance[\s\-]?seed|bytedance[\s\-]?image|doubao[\s\-]?image)\b/i,
    modelId: 'bytedance-seed/seedream-4.5',
    label: 'Seedream 4.5',
    highConfidence: true,
  },

  // ── Default / RouteLLM explícito ──
  {
    regex: /\b(routellm|route[\s\-]?llm|abacus[\s\-]?default|modelo[\s\-]?default|modelo[\s\-]?por[\s\-]?defecto)\b/i,
    modelId: 'default',
    label: 'RouteLLM (default)',
    highConfidence: true,
  },
]

/**
 * Detecta el modelo mencionado en el mensaje del usuario.
 * Devuelve el modelId o null si no hay mención explícita.
 * 
 * La detección sólo se activa cuando el mensaje parece relacionado con generar
 * imagen (para evitar falsos positivos en conversaciones sobre, e.g., "flux de
 * caja" en finanzas).
 */
export function detectImageModelFromMessage(message: string): {
  modelId: string | null
  matchedPattern: string | null
  label: string | null
} {
  if (!message || typeof message !== 'string') {
    return { modelId: null, matchedPattern: null, label: null }
  }

  // Contexto de imagen — para patrones ambiguos
  const imageContextRegex = /\b(imagen|imagenes|image|picture|foto|photo|generar|genera|crear|crea|diseñ|design|render|visual|ilustra|draw|paint|cuadr|poster|banner|ad|anuncio|campaña|portada|cover|modelo|model|usa|usar|use|con|cambia|switch)\b/i
  const hasImageContext = imageContextRegex.test(message)

  for (const pattern of MODEL_PATTERNS) {
    const match = message.match(pattern.regex)
    if (match) {
      // Los patrones de alta confianza (nombres únicos tipo "nano banana",
      // "gpt-5.4") se detectan SIEMPRE. Los ambiguos ("gemini", "flux" solos)
      // requieren palabra de contexto.
      if (!pattern.highConfidence && !hasImageContext) continue

      // Validar que el modelId exista en el catálogo (seguridad)
      if (pattern.modelId === 'default' || IMAGE_MODELS.some(m => m.id === pattern.modelId)) {
        return {
          modelId: pattern.modelId,
          matchedPattern: match[0],
          label: pattern.label,
        }
      }
    }
  }

  return { modelId: null, matchedPattern: null, label: null }
}

/**
 * Devuelve el label legible para un modelId (útil para mostrar en UI/logs).
 */
export function getModelLabel(modelId: string | null | undefined): string {
  if (!modelId || modelId === 'default') return 'RouteLLM (default)'
  const model = IMAGE_MODELS.find(m => m.id === modelId)
  if (!model) return modelId
  return `${model.emoji} ${model.id.split('/').pop() || modelId}`
}

/**
 * Resuelve el modelo final a usar, aplicando la siguiente cadena de decisión:
 * 1. Si el usuario pasó un modelId explícito (desde el dropdown) → usar ese
 * 2. Si el mensaje menciona un modelo por nombre → usar el detectado
 * 3. Fallback al DEFAULT_IMAGE_MODEL_ID
 */
export function resolveImageModel(
  explicitModelId: string | null | undefined,
  userMessage: string | null | undefined
): { modelId: string; source: 'explicit' | 'detected' | 'default'; label: string } {
  // 1. Explícito del dropdown — mayor prioridad
  if (explicitModelId && explicitModelId !== 'auto') {
    return {
      modelId: explicitModelId,
      source: 'explicit',
      label: getModelLabel(explicitModelId),
    }
  }

  // 2. Detectado del mensaje
  if (userMessage) {
    const detected = detectImageModelFromMessage(userMessage)
    if (detected.modelId) {
      return {
        modelId: detected.modelId,
        source: 'detected',
        label: detected.label || getModelLabel(detected.modelId),
      }
    }
  }

  // 3. Default (usa el del catálogo, no RouteLLM directo)
  // Nota: si no hay clave de OpenRouter, el backend cae a RouteLLM
  return {
    modelId: DEFAULT_IMAGE_MODEL_ID,
    source: 'default',
    label: getModelLabel(DEFAULT_IMAGE_MODEL_ID),
  }
}
