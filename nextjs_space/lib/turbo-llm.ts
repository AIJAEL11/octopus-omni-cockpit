// ============================================
// TURBO MODE - OpenRouter LLM Engine
// Una sola API key via OpenRouter, formato compatible OpenAI
// ============================================
// 
// FLOW DE PRIORIDAD:
// 1. Turbo Mode (OpenRouter con modelo elegido por usuario)
// 2. Abacus AI (apps.abacus.ai con ABACUSAI_API_KEY)
// 3. 🆘 EMERGENCY: OpenRouter con Kimi K2 (si Abacus no está disponible)
//    → Para migración a Hostinger u otro hosting sin Abacus AI
// ============================================

import { prisma, withDbRetry } from '@/lib/prisma'
import { OPENROUTER_BASE_URL, TURBO_AUTO_SELECT_ID, autoSelectBestModel } from '@/lib/turbo-config'
import type { AutoSelectStrategy } from '@/lib/turbo-config'

// ============================================
// 🆘 MODELO DE EMERGENCIA — Backup para cuando no hay Abacus AI
// Se usa automáticamente si ABACUSAI_API_KEY no existe o Abacus AI falla.
// Kimi K2 es económico ($0.60/M), inteligente y tiene 131K contexto.
// ============================================
const EMERGENCY_MODEL = 'moonshotai/kimi-k2'
const EMERGENCY_MODEL_LABEL = 'Kimi K2 (Emergency)'

/**
 * Busca CUALQUIER API key de OpenRouter activa en la DB.
 * Se usa como último recurso cuando Abacus AI no está disponible.
 */
async function getEmergencyOpenRouterKey(): Promise<string | null> {
  try {
    // Primero intentar env var directa (para Hostinger sin DB de Abacus)
    if (process.env.OPENROUTER_API_KEY) {
      return process.env.OPENROUTER_API_KEY
    }
    // Buscar cualquier key activa de OpenRouter en la DB
    const record = await prisma.apiKey.findFirst({
      where: { serviceType: 'turbo_openrouter', status: 'active' },
      select: { apiKey: true },
    })
    return record?.apiKey || null
  } catch {
    return null
  }
}

/**
 * Llamada de emergencia a OpenRouter con modelo por defecto (Kimi K2).
 * Se ejecuta automáticamente cuando Abacus AI no está disponible.
 */
async function callEmergencyOpenRouter(
  messages: { role: string; content: string | unknown[] }[],
  options: { model?: string; temperature?: number; maxTokens?: number; stream?: boolean; responseFormat?: Record<string, unknown> } = {}
): Promise<Response> {
  const apiKey = await getEmergencyOpenRouterKey()
  if (!apiKey) {
    throw new Error('No LLM engine available: No Abacus AI key, no OpenRouter key. Configure Turbo Mode or set OPENROUTER_API_KEY.')
  }
  
  const { temperature = 0.7, maxTokens = 4000, stream = false, responseFormat } = options
  
  const body: Record<string, unknown> = {
    model: EMERGENCY_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream,
  }
  if (stream) body.stream_options = { include_usage: true }
  if (responseFormat) body.response_format = responseFormat
  
  console.log(`[🆘 Emergency LLM] Using ${EMERGENCY_MODEL_LABEL} via OpenRouter (Abacus AI unavailable)`)
  
  return fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://octopus.app',
      'X-Title': 'OCTOPUS Omni Cockpit',
    },
    body: JSON.stringify(body),
  })
}

interface TurboConfig {
  enabled: boolean
  model: string | null
  apiKey: string | null
}

// Obtener config turbo del usuario
export async function getUserTurboConfig(userId: string): Promise<TurboConfig> {
  try {
    const user = await withDbRetry(() => prisma.user.findUnique({
      where: { id: userId },
      select: { turboEnabled: true, turboModel: true },
    }))
    
    if (!user?.turboEnabled || !user.turboModel) {
      return { enabled: false, model: null, apiKey: null }
    }
    
    // Buscar API key de OpenRouter
    const apiKeyRecord = await withDbRetry(() => prisma.apiKey.findFirst({
      where: { userId, serviceType: 'turbo_openrouter', status: 'active' },
    }))
    
    if (!apiKeyRecord) {
      return { enabled: false, model: user.turboModel, apiKey: null }
    }
    
    // Incrementar uso (non-blocking)
    prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsed: new Date(), usageCount: { increment: 1 } },
    }).catch(() => {})
    
    // Resolve auto-select to actual model
    let resolvedModel = user.turboModel
    if (resolvedModel.startsWith(TURBO_AUTO_SELECT_ID)) {
      // Format: auto_best, auto_best:smartest, auto_best:efficient, auto_best:balanced
      const parts = resolvedModel.split(':')
      const strategy = (parts[1] as AutoSelectStrategy) || 'balanced'
      const bestModel = autoSelectBestModel(strategy)
      resolvedModel = bestModel.id
      console.log(`[Turbo] Auto-selected: ${bestModel.name} (${bestModel.provider}) via strategy: ${strategy}`)
    }
    
    return {
      enabled: true,
      model: resolvedModel,
      apiKey: apiKeyRecord.apiKey,
    }
  } catch {
    return { enabled: false, model: null, apiKey: null }
  }
}

/**
 * Obtiene la key de OpenRouter del usuario SIN chequear turboEnabled.
 * Esto permite que el selector de modelo funcione aunque Turbo esté apagado.
 */
export async function getUserOpenRouterKey(userId: string): Promise<string | null> {
  try {
    const key = await withDbRetry(() =>
      prisma.apiKey.findFirst({
        where: { userId, serviceType: 'turbo_openrouter', status: 'active' },
        select: { apiKey: true },
      })
    )
    return key?.apiKey || null
  } catch {
    return null
  }
}

// Construir request para OpenRouter (formato OpenAI compatible)
export function buildTurboRequest(
  config: TurboConfig,
  messages: { role: string; content: string | unknown[] }[],
  options: { temperature?: number; maxTokens?: number; stream?: boolean } = {}
): { url: string; headers: Record<string, string>; body: string } | null {
  if (!config.enabled || !config.apiKey || !config.model) return null
  
  const { temperature = 0.7, maxTokens = 4000, stream = true } = options
  
  // OpenRouter usa formato OpenAI — simple y directo
  return {
    url: `${OPENROUTER_BASE_URL}/chat/completions`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'HTTP-Referer': 'https://octopus.app',
      'X-Title': 'OCTOPUS Omni Cockpit',
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: config.model.includes('/o3') ? undefined : temperature,
      max_tokens: maxTokens,
      stream,
      // Pide el desglose de tokens en el chunk final (token tracking)
      ...(stream ? { stream_options: { include_usage: true } } : {}),
    }),
  }
}

// Parse streaming (OpenRouter usa formato SSE idéntico a OpenAI)
export function parseTurboStreamChunk(_provider: string, data: string): string | null {
  try {
    if (data === '[DONE]') return null
    const parsed = JSON.parse(data)
    return parsed.choices?.[0]?.delta?.content || null
  } catch {
    return null
  }
}

/**
 * Maps OpenRouter-style model IDs to Abacus AI equivalents.
 * E.g. "anthropic/claude-sonnet-4.6" → "claude-sonnet-4-6"
 * Returns 'gpt-4.1' for models with no Abacus equivalent (safety fallback).
 */
export function toAbacusModel(model: string): string {
  const stripped = model.includes('/') ? model.split('/').pop()! : model
  const mapping: Record<string, string> = {
    'claude-fable-5': 'claude-sonnet-4-6',
    'claude-opus-4.8': 'claude-sonnet-4-6',
    'claude-opus-4.7': 'claude-opus-4-7',
    'claude-opus-4.6': 'claude-opus-4-6',
    'claude-sonnet-4.6': 'claude-sonnet-4-6',
    'claude-sonnet-4.5': 'claude-sonnet-4-5-20250929',
    'claude-opus-4.5': 'claude-opus-4-5-20251101',
    'claude-haiku-4.5': 'claude-haiku-4-5-20251001',
    'gpt-5.4': 'gpt-4.1',
    'gpt-5.4-mini': 'gpt-4.1-mini',
    'o3': 'gpt-4.1',
    'gpt-4o': 'gpt-4o',
  }
  // Models with no Abacus equivalent → safe fallback
  const NO_ABACUS = ['gemini-3.1-pro-preview', 'gemini-3-flash-preview', 'deepseek-chat-v3-0324', 'grok-4.1-fast', 'kimi-k2-thinking', 'kimi-k2.5', 'deepseek-v3.2']
  if (NO_ABACUS.some(s => stripped.includes(s))) return 'gpt-4.1'
  return mapping[stripped] || stripped
}

/**
 * Centralized LLM call — auto-routes via Turbo Mode (OpenRouter) or Abacus AI fallback.
 * Use this for ALL non-streaming LLM calls across the platform.
 * 
 * @param userId - User ID to check Turbo Mode config. Pass null to skip Turbo and use Abacus AI directly.
 * @param messages - Chat messages array
 * @param options - model, temperature, maxTokens, stream
 * @returns The LLM response object (parsed JSON)
 */
export async function callLLM(
  userId: string | null,
  messages: { role: string; content: string | unknown[] }[],
  options: { 
    model?: string; 
    temperature?: number; 
    maxTokens?: number; 
    stream?: boolean;
    responseFormat?: Record<string, unknown>;
  } = {}
): Promise<{ choices: { message: { content: string; role: string } }[]; model?: string; engine?: string }> {
  const { model = 'gpt-4.1', temperature = 0.7, maxTokens = 4000, stream = false, responseFormat } = options

  // Try Turbo Mode if userId provided
  if (userId) {
    try {
      const turboConfig = await getUserTurboConfig(userId)
      const turboReq = buildTurboRequest(turboConfig, messages, { temperature, maxTokens, stream })
      
      if (turboReq) {
        // Add response_format to body if provided
        if (responseFormat) {
          const body = JSON.parse(turboReq.body)
          body.response_format = responseFormat
          turboReq.body = JSON.stringify(body)
        }
        
        const res = await fetch(turboReq.url, {
          method: 'POST',
          headers: turboReq.headers,
          body: turboReq.body
        })
        
        if (res.ok) {
          const data = await res.json()
          data.engine = `Turbo: ${turboConfig.model}`
          return data
        }
        console.warn(`[callLLM] Turbo failed (${res.status}), falling back to Abacus AI`)
      }
    } catch (err) {
      console.warn('[callLLM] Turbo error, falling back:', err)
    }
  }

  // Abacus AI fallback (only if key exists)
  if (process.env.ABACUSAI_API_KEY) {
    try {
      const abacusModel = toAbacusModel(model)
      const body: Record<string, unknown> = {
        model: abacusModel,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream,
      }
      if (responseFormat) body.response_format = responseFormat

      const res = await fetch('https://apps.abacus.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
        },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const data = await res.json()
        data.engine = `Abacus AI: ${abacusModel}`
        return data
      }
      const errBody = await res.text().catch(() => '')
      console.warn(`[callLLM] Abacus AI failed (${res.status}) model=${abacusModel}: ${errBody.substring(0, 300)}`)
    } catch (abacusErr) {
      console.warn('[callLLM] Abacus AI error, trying emergency fallback:', abacusErr)
    }
  }

  // 🆘 EMERGENCY FALLBACK — OpenRouter con Kimi K2
  // Se activa cuando: (a) no hay ABACUSAI_API_KEY, o (b) Abacus AI falló
  const emergencyRes = await callEmergencyOpenRouter(messages, { temperature, maxTokens, stream, responseFormat })
  
  if (!emergencyRes.ok) {
    const errText = await emergencyRes.text().catch(() => '')
    throw new Error(`All LLM engines failed. Emergency (${EMERGENCY_MODEL}) error ${emergencyRes.status}: ${errText.substring(0, 200)}`)
  }

  const data = await emergencyRes.json()
  data.engine = `🆘 Emergency: ${EMERGENCY_MODEL_LABEL}`
  return data
}

/**
 * Streaming version of callLLM — returns a Response with SSE stream.
 * Routes through Turbo Mode or falls back to Abacus AI.
 */
export async function callLLMStream(
  userId: string | null,
  messages: { role: string; content: string | unknown[] }[],
  options: { model?: string; temperature?: number; maxTokens?: number } = {}
): Promise<Response> {
  const { model = 'gpt-4.1', temperature = 0.7, maxTokens = 4000 } = options

  // Try Turbo Mode
  if (userId) {
    try {
      const turboConfig = await getUserTurboConfig(userId)
      // Honor explicit OpenRouter-style model override from caller (e.g. "anthropic/claude-sonnet-4.6")
      const overrideModel = options.model && options.model.includes('/') ? options.model : null
      const effectiveConfig = overrideModel && turboConfig.enabled
        ? { ...turboConfig, model: overrideModel }
        : turboConfig
      const turboReq = buildTurboRequest(effectiveConfig, messages, { temperature, maxTokens, stream: true })
      
      if (turboReq) {
        const res = await fetch(turboReq.url, {
          method: 'POST',
          headers: turboReq.headers,
          body: turboReq.body
        })
        if (res.ok) return res
        console.warn(`[callLLMStream] Turbo failed (${res.status}), falling back`)
      }
    } catch (err) {
      console.warn('[callLLMStream] Turbo error, falling back:', err)
    }
  }

  // Abacus AI fallback (only if key exists)
  if (process.env.ABACUSAI_API_KEY) {
    try {
      const abacusModel = toAbacusModel(model)
      console.log(`[callLLMStream] Trying Abacus AI with model=${abacusModel} (original: ${model})`)
      const res = await fetch('https://apps.abacus.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: abacusModel,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
          stream_options: { include_usage: true },
        }),
      })
      if (res.ok) return res
      const errBody = await res.text().catch(() => '')
      console.warn(`[callLLMStream] Abacus AI failed (${res.status}) model=${abacusModel}: ${errBody.substring(0, 300)}`)
    } catch (abacusErr) {
      console.warn('[callLLMStream] Abacus AI error, trying emergency fallback:', abacusErr)
    }
  }

  // 🆘 EMERGENCY FALLBACK — OpenRouter con Kimi K2 (streaming)
  console.warn('[callLLMStream] All primary engines failed, trying emergency OpenRouter...')
  return callEmergencyOpenRouter(messages, { temperature, maxTokens, stream: true })
}
// Code Engine fix v2 - 1777322795
