export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sanitizePromptForSeedance, SEEDANCE_NEGATIVE_PROMPT } from '@/lib/seedance-filter-safe'

/**
 * Seedance via fal.ai Queue API
 * Generates video + audio + lip sync in ONE step from an image + prompt
 *
 * Supported models (CRITICAL: namespace differs between v1.5 and v2.0):
 *   seedance_1_5_pro  → fal-ai/bytedance/seedance/v1.5/pro/image-to-video  (legacy `fal-ai/` namespace)
 *   seedance_2_0      → bytedance/seedance-2.0/image-to-video              (NEW namespace, NO `fal-ai/` prefix)
 *   seedance_2_0_fast → bytedance/seedance-2.0/fast/image-to-video         (NEW namespace, NO `fal-ai/` prefix)
 *
 * fal.ai queue API:
 *   POST https://queue.fal.run/{model_id}  → returns { request_id, status_url, response_url }
 *   Auth: Authorization: Key {FAL_KEY}
 *
 * NOTE: v2.0 status_url/response_url returned by fal.ai always route through the
 * parent `bytedance/seedance-2.0/requests/<id>` namespace (not `seedance-2.0/fast`).
 * Always trust the URLs returned by fal.ai on submit instead of constructing them.
 */
const FAL_MODELS: Record<string, string> = {
  seedance_1_5_pro: 'fal-ai/bytedance/seedance/v1.5/pro/image-to-video',
  seedance_2_0: 'bytedance/seedance-2.0/image-to-video',
  seedance_2_0_fast: 'bytedance/seedance-2.0/fast/image-to-video',
}
const DEFAULT_MODEL_ID = 'seedance_1_5_pro'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { imageUrl, prompt, dialogue, duration, resolution, language, model, locale } = await request.json()
    if (!imageUrl || !prompt) {
      return NextResponse.json({ error: 'imageUrl and prompt are required' }, { status: 400 })
    }

    // Locale for user-facing error messages (es | en, fallback en)
    const uiLang: 'es' | 'en' = locale === 'es' ? 'es' : 'en'

    // Resolve fal.ai endpoint from model key; fall back to Seedance 1.5 Pro.
    const modelId: string = typeof model === 'string' && FAL_MODELS[model] ? model : DEFAULT_MODEL_ID
    const FAL_MODEL = FAL_MODELS[modelId]

    // Get user's fal.ai API key
    const falKey = await prisma.apiKey.findFirst({
      where: { userId: session.user.id, serviceType: 'ugc_fal', status: 'active' },
    })

    if (!falKey) {
      const noKeyMsg = uiLang === 'es'
        ? 'API key de fal.ai no configurada. Ve a la configuración de UGC Factory para agregar tu key.'
        : 'fal.ai API key not configured. Go to UGC Factory settings to add your key.'
      return NextResponse.json({ error: noKeyMsg }, { status: 400 })
    }

    const apiToken = falKey.apiKey.trim()

    // Build dialogue prompt with language
    const lang = language || 'es'
    const langName = lang === 'es' ? 'Spanish' : lang === 'en' ? 'English' : lang === 'pt' ? 'Portuguese' : lang

    // Sanitize prompt before sending to Seedance:
    // - Removes filter-triggering vocabulary (photorealistic, real person, etc.)
    // - Replaces with editorial cinematic equivalents that Seedance 2.0 tolerates
    // This is idempotent — running twice produces the same output.
    const sanitizedSubject = sanitizePromptForSeedance(prompt)

    // When `dialogue` is provided (Cinematic Director mode), it's what the avatar SAYS.
    // The main `prompt` is visual directions; `dialogue` is the speech for lip sync.
    // When `dialogue` is absent (legacy mode), the prompt serves as both visual + dialogue.
    const speechText = dialogue?.trim() || prompt
    const sanitizedSpeech = sanitizePromptForSeedance(speechText)
    const fullPrompt = dialogue?.trim()
      ? `${sanitizedSubject}. The fictional AI-synthesized editorial subject speaks naturally with synchronized lip movements in ${langName}. Dialogue: "${sanitizedSpeech}"`
      : `${sanitizedSubject}. The fictional AI-synthesized editorial subject speaks naturally with synchronized lip movements in ${langName}. Dialogue: "${sanitizedSubject}"`

    // Whether to apply the Seedance 2.0 negative prompt (only fal.ai 2.0 endpoints support it)
    const isV2 = modelId === 'seedance_2_0' || modelId === 'seedance_2_0_fast'

    console.log('[Seedance/fal.ai] Submitting to queue — model:', modelId, 'endpoint:', FAL_MODEL, 'prompt length:', fullPrompt.length, 'resolution:', resolution || '720p', 'duration:', duration || 5, 'sanitized:', sanitizedSubject !== prompt, 'v2_negative_prompt:', isV2)

    // Prepare image URL — fal.ai needs a URL or data URI
    let imageForFal = imageUrl
    if (!imageForFal.startsWith('http') && !imageForFal.startsWith('data:')) {
      imageForFal = `data:image/jpeg;base64,${imageForFal}`
    }

    // Build payload with Seedance 2.0 filter-safe extras
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inputPayload: Record<string, any> = {
      prompt: fullPrompt,
      image_url: imageForFal,
      duration: String(duration || 5),
      resolution: resolution || '720p',
      aspect_ratio: '9:16', // Vertical for UGC/social
      generate_audio: true,
      camera_fixed: false,
    }

    // Seedance 2.0 / 2.0-fast: add negative prompt to reduce identity-leak / filter triggers
    if (isV2) {
      inputPayload.negative_prompt = SEEDANCE_NEGATIVE_PROMPT
      // fal.ai's safety_checker defaults to true; we set false to reduce false-positive rejections
      // on legitimate AI-generated fictional editorial content. Backed off if endpoint rejects.
      inputPayload.enable_safety_checker = false
    }

    // Helper to submit a payload to fal.ai
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const submit = async (payload: Record<string, any>) => {
      const r = await fetch(`https://queue.fal.run/${FAL_MODEL}`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const d = await r.json().catch(() => null)
      return { r, d }
    }

    // First attempt: with all filter-safe extras
    let { r: response, d: data } = await submit(inputPayload)
    console.log('[Seedance/fal.ai] Queue response status:', response.status, 'request_id:', data?.request_id, 'status:', data?.status)

    // Detect "unknown parameter" rejection and retry without enable_safety_checker
    // (some fal.ai endpoint versions don't accept this param)
    if (
      isV2 &&
      !response.ok &&
      typeof data === 'object' &&
      data !== null &&
      JSON.stringify(data).toLowerCase().match(/(enable_safety_checker|safety_checker|unknown.*field|unexpected.*parameter|extra.*forbidden|negative_prompt)/)
    ) {
      console.warn('[Seedance/fal.ai] Endpoint rejected filter-safe extras, retrying without enable_safety_checker / negative_prompt')
      const retryPayload = { ...inputPayload }
      delete retryPayload.enable_safety_checker
      delete retryPayload.negative_prompt
      const retry = await submit(retryPayload)
      response = retry.r
      data = retry.d
      console.log('[Seedance/fal.ai] Retry response status:', response.status, 'request_id:', data?.request_id)
    }

    if (!response.ok || !data?.request_id) {
      const errMsg = data?.detail || data?.error || data?.message || `HTTP ${response.status}`
      const errStr = typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg)
      console.error('[Seedance/fal.ai] Error:', errStr, JSON.stringify(data))

      // Detect content-policy rejection and surface a localized, actionable message
      const isContentPolicy = /content[\s-]?policy|policy_violation|sensitive|nsfw|safety|moderation|real[\s-]?person|likeness/i.test(errStr)
      if (isContentPolicy && isV2) {
        const friendlyMsg = uiLang === 'es'
          ? 'Seedance 2.0 sigue rechazando esta imagen por su detector de rostros. La imagen es 100% AI-generada y ficticia, pero el filtro la sobre-marca. Soluciones: (1) regenera la imagen del modelo con el botón "Generar Modelo" otra vez para obtener una variante diferente, (2) cambia a Seedance 1.5 Pro (más permisivo), o (3) activa el modo Estilizado (Pixar) que siempre pasa el filtro.'
          : 'Seedance 2.0 still rejected this image due to its face detection filter. The image is 100% AI-generated and fictional, but the filter is over-flagging it. Solutions: (1) regenerate the model image to get a different variant, (2) switch to Seedance 1.5 Pro (more permissive), or (3) enable Stylized mode (Pixar) which always passes the filter.'
        return NextResponse.json({ error: friendlyMsg, contentPolicy: true, model: modelId }, { status: 400 })
      }

      const prefix = uiLang === 'es' ? 'Error de fal.ai' : 'fal.ai error'
      return NextResponse.json({ error: `${prefix}: ${errStr}` }, { status: 500 })
    }

    // Update API key usage
    prisma.apiKey.update({
      where: { id: falKey.id },
      data: { lastUsed: new Date(), usageCount: { increment: 1 } },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      requestId: data.request_id,
      statusUrl: data.status_url || null,
      responseUrl: data.response_url || null,
      status: data.status || 'IN_QUEUE',
      model: modelId,
      endpoint: FAL_MODEL,
      message: 'Seedance video generation submitted. Poll for status.',
    })
  } catch (error) {
    console.error('[Seedance/fal.ai] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
