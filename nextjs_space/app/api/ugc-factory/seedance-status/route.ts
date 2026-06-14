export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Poll Seedance (1.5 Pro / 2.0 Pro / 2.0 Fast) status via fal.ai Queue API
 * Uses the status_url and response_url provided by fal.ai on submit.
 * The fallback endpoint is selected from the `model` field in the body.
 *
 * IMPORTANT: For v2.0, fal.ai's queue routes status URLs through the PARENT
 * namespace `bytedance/seedance-2.0/requests/<id>` (even for the /fast variant).
 * The fallback below uses the same parent namespace for v2.0 Fast.
 */
const FAL_MODELS: Record<string, string> = {
  seedance_1_5_pro: 'fal-ai/bytedance/seedance/v1.5/pro/image-to-video',
  seedance_2_0: 'bytedance/seedance-2.0/image-to-video',
  seedance_2_0_fast: 'bytedance/seedance-2.0/fast/image-to-video',
}

/**
 * Build the status URL parent namespace for a model.
 * - v1.5 Pro: full `fal-ai/bytedance/seedance/v1.5/pro` path is used.
 * - v2.0 (any variant): always routes through `bytedance/seedance-2.0` parent.
 */
function statusBasePath(modelId: string): string {
  if (modelId === 'seedance_1_5_pro') return 'fal-ai/bytedance/seedance/v1.5/pro'
  // Both v2.0 Pro and v2.0 Fast use the same parent namespace for status polling
  return 'bytedance/seedance-2.0'
}
const DEFAULT_MODEL_ID = 'seedance_1_5_pro'

/**
 * Seedance models can return the video in a few shapes across versions.
 * This helper tries each known location and returns the first non-empty URL.
 */
function extractVideoUrl(result: any): string | null {
  if (!result || typeof result !== 'object') return null
  const candidates: Array<string | undefined> = [
    result?.video?.url,
    result?.output?.video?.url,
    result?.data?.video?.url,
    Array.isArray(result?.videos) ? result.videos[0]?.url : undefined,
    Array.isArray(result?.data?.videos) ? result.data.videos[0]?.url : undefined,
    result?.url,
    result?.output_url,
    result?.video_url,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.startsWith('http')) return c
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { requestId, statusUrl, responseUrl, model, locale } = await request.json()
    if (!requestId) {
      return NextResponse.json({ error: 'requestId is required' }, { status: 400 })
    }

    // Normalize locale → 'en' fallback (matches lib/i18n-context.tsx supported locales)
    const lang: 'es' | 'en' = locale === 'es' ? 'es' : 'en'

    // Get user's fal.ai API key
    const falKey = await prisma.apiKey.findFirst({
      where: { userId: session.user.id, serviceType: 'ugc_fal', status: 'active' },
    })

    if (!falKey) {
      return NextResponse.json({ error: 'fal.ai API key not configured' }, { status: 400 })
    }

    const apiToken = falKey.apiKey.trim()

    // Resolve fallback model endpoint (only used if fal.ai didn't return the URLs).
    const modelId: string = typeof model === 'string' && FAL_MODELS[model] ? model : DEFAULT_MODEL_ID

    // Status polling uses the PARENT namespace for v2.0 (even for /fast variant).
    const statusBase = statusBasePath(modelId)

    // Use the status_url provided by fal.ai, or construct fallback
    const checkStatusUrl = statusUrl || `https://queue.fal.run/${statusBase}/requests/${requestId}/status`
    const checkResponseUrl = responseUrl || `https://queue.fal.run/${statusBase}/requests/${requestId}`

    // Check status
    const statusResponse = await fetch(checkStatusUrl, {
      method: 'GET',
      headers: { 'Authorization': `Key ${apiToken}` },
    })

    const statusData = await statusResponse.json().catch(() => null)
    console.log('[Seedance-Status/fal.ai] Request', requestId, '— HTTP:', statusResponse.status, '— status:', statusData?.status, '— model:', modelId)

    if (!statusResponse.ok || !statusData) {
      const errMsg = statusData?.detail || statusData?.error || `HTTP ${statusResponse.status}`
      console.error('[Seedance-Status/fal.ai] Error:', errMsg)
      const prefix = lang === 'es' ? 'Error de estado fal.ai' : 'fal.ai status error'
      return NextResponse.json({ error: `${prefix}: ${errMsg}` }, { status: 500 })
    }

    // fal.ai statuses: IN_QUEUE, IN_PROGRESS, COMPLETED
    if (statusData.status === 'COMPLETED') {
      // Fetch the actual result using response_url
      const resultResponse = await fetch(checkResponseUrl, {
        method: 'GET',
        headers: { 'Authorization': `Key ${apiToken}` },
      })

      const resultData = await resultResponse.json().catch(() => null)
      const videoUrl = extractVideoUrl(resultData)
      console.log('[Seedance-Status/fal.ai] Result video URL:', videoUrl, '— raw keys:', resultData ? Object.keys(resultData) : null)

      // SUCCESS path — got a valid video URL
      if (videoUrl) {
        return NextResponse.json({
          success: true,
          status: 'completed',
          videoUrl,
        })
      }

      // FAILURE path — fal.ai sometimes returns HTTP 200 with status:COMPLETED
      // even when the request actually failed (e.g. content_policy_violation).
      // The error info is in `result.detail` (FastAPI-style validation error array).
      console.error('[Seedance-Status/fal.ai] No videoUrl extracted — raw payload:', JSON.stringify(resultData).slice(0, 1200))

      // Localized error messages (es + en). Falls back to en for any other locale.
      const isV2 = modelId === 'seedance_2_0' || modelId === 'seedance_2_0_fast'
      const messages = {
        es: {
          completedNoVideo: 'fal.ai devolvió COMPLETED pero sin video. Intenta de nuevo o cambia de modelo.',
          contentPolicyV2: 'Seedance 2.0 rechazó la imagen por su política de contenido (rostros de personas reales / información privada). Seedance 1.5 Pro suele ser más permisivo — prueba con 1.5 Pro o usa una imagen de avatar generada por IA sin rasgos reales.',
          contentPolicyOther: (msg: string) => `fal.ai bloqueó la generación: ${msg}`,
          falError: (msg: string) => `Error de fal.ai: ${msg}`,
        },
        en: {
          completedNoVideo: 'fal.ai returned COMPLETED but no video was produced. Please try again or switch model.',
          contentPolicyV2: 'Seedance 2.0 rejected the image due to its content policy (real-person likenesses / private information). Seedance 1.5 Pro is usually more permissive — try 1.5 Pro or use an AI-generated avatar image without real-people features.',
          contentPolicyOther: (msg: string) => `fal.ai blocked the generation: ${msg}`,
          falError: (msg: string) => `fal.ai error: ${msg}`,
        },
      }
      const m = messages[lang]

      // Try to extract a human-readable error from result.detail
      let errorMsg = m.completedNoVideo
      if (resultData?.detail) {
        const detail = resultData.detail
        // FastAPI validation errors come as an array of {loc, msg, type, ctx}
        if (Array.isArray(detail) && detail.length > 0) {
          const first = detail[0]
          const msg = first?.msg || ''
          const type = first?.type || ''
          if (type === 'content_policy_violation' || /content.?policy/i.test(msg)) {
            errorMsg = isV2 ? m.contentPolicyV2 : m.contentPolicyOther(msg)
          } else {
            errorMsg = m.falError(msg)
          }
        } else if (typeof detail === 'string') {
          errorMsg = m.falError(detail)
        }
      } else if (resultData?.error) {
        errorMsg = m.falError(resultData.error)
      }

      return NextResponse.json({
        success: false,
        status: 'failed',
        videoUrl: null,
        error: errorMsg,
      })
    }

    // Still processing
    return NextResponse.json({
      success: true,
      status: 'processing',
      videoUrl: null,
      queuePosition: statusData.queue_position ?? null,
    })
  } catch (error) {
    console.error('[Seedance-Status/fal.ai] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}