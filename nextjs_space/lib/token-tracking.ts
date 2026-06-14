// ═══════════════════════════════════════════════════════════════════════════════
// 💰 TOKEN TRACKING — Conteo de tokens y costo estimado por sesión del Code Engine
// ───────────────────────────────────────────────────────────────────────────────
// Captura el uso real de tokens cuando el proveedor lo reporta (OpenRouter/Abacus
// con stream_options.include_usage). Si no está disponible, estima por caracteres
// (~4 chars/token). El costo se calcula con una tabla de precios por modelo.
//
// Objetivo: que el usuario vea cuánto consume cada sesión y pueda elegir entre un
// modelo caro (Opus) o uno económico (Sonnet/Kimi) con datos reales.
// ═══════════════════════════════════════════════════════════════════════════════

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/** Estimación barata de tokens a partir de texto (~4 chars/token). */
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

/**
 * Extrae usage de un chunk SSE del proveedor si viene presente.
 * OpenRouter/OpenAI devuelven { usage: { prompt_tokens, completion_tokens, total_tokens } }
 * en el chunk final cuando se pide stream_options.include_usage.
 */
export function extractUsageFromChunk(json: unknown): TokenUsage | null {
  try {
    const u = (json as { usage?: Record<string, number> })?.usage
    if (!u) return null
    const prompt = u.prompt_tokens ?? 0
    const completion = u.completion_tokens ?? 0
    const total = u.total_tokens ?? prompt + completion
    if (prompt === 0 && completion === 0 && total === 0) return null
    return { promptTokens: prompt, completionTokens: completion, totalTokens: total }
  } catch {
    return null
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Tabla de precios — USD por 1M de tokens (input / output)
// Acepta IDs estilo OpenRouter ("anthropic/claude-...") o Abacus ("claude-...").
// Actualizar cuando cambien las tarifas.
// ───────────────────────────────────────────────────────────────────────────────

interface Price { in: number; out: number }

const MODEL_PRICING: Record<string, Price> = {
  // Anthropic Claude
  'claude-opus-4': { in: 15, out: 75 },
  'claude-sonnet-4': { in: 3, out: 15 },
  'claude-haiku-4': { in: 1, out: 5 },
  'claude-fable-5': { in: 3, out: 15 },
  'claude-3-5-sonnet': { in: 3, out: 15 },
  'claude-3-5-haiku': { in: 0.8, out: 4 },
  // OpenAI
  'gpt-4.1': { in: 2, out: 8 },
  'gpt-4o': { in: 2.5, out: 10 },
  'o3': { in: 2, out: 8 },
  // Económicos / open
  'kimi-k2': { in: 0.6, out: 0.6 },
  'moonshotai/kimi-k2': { in: 0.6, out: 0.6 },
  'deepseek': { in: 0.3, out: 0.3 },
  'llama': { in: 0.2, out: 0.2 },
  'gemini': { in: 0.3, out: 1.2 },
}

const DEFAULT_PRICE: Price = { in: 2, out: 8 }

/** Resuelve el precio de un modelo por coincidencia parcial de su id normalizado. */
function priceForModel(model: string): Price {
  const id = (model || '').toLowerCase()
  // Coincidencia exacta primero
  if (MODEL_PRICING[id]) return MODEL_PRICING[id]
  // Coincidencia por familia (el más largo gana para evitar falsos positivos)
  let best: { key: string; price: Price } | null = null
  for (const [key, price] of Object.entries(MODEL_PRICING)) {
    if (id.includes(key) && (!best || key.length > best.key.length)) {
      best = { key, price }
    }
  }
  return best?.price ?? DEFAULT_PRICE
}

/** Costo estimado en USD para un uso dado y un modelo. */
export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const p = priceForModel(model)
  const cost = (usage.promptTokens / 1_000_000) * p.in + (usage.completionTokens / 1_000_000) * p.out
  // Redondea a 6 decimales (microcentavos)
  return Math.round(cost * 1e6) / 1e6
}

/** Formatea un costo USD para mostrar en UI. */
export function formatCostUsd(cost: number): string {
  if (cost <= 0) return '$0.00'
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}
