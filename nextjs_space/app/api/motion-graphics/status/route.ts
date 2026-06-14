export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'
import { decryptApiKey } from '@/lib/crypto'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { requestId, model, statusUrl, responseUrl } = await request.json()
    if (!requestId) {
      return NextResponse.json({ error: 'requestId is required' }, { status: 400 })
    }

    // Get fal.ai API key (with retry for connection pool resilience)
    let falKey: string | null = null

    const userApiKey: any = await withDbRetry(
      () => prisma.apiKey.findFirst({
        where: { userId: session.user.id, serviceType: 'falai', status: 'active' },
      }),
      { label: 'MoGraph-Status-FalKey' }
    )
    if (userApiKey) {
      falKey = decryptApiKey(userApiKey.apiKey)
    }

    if (!falKey) {
      const ugcFalKey: any = await withDbRetry(
        () => prisma.apiKey.findFirst({
          where: { userId: session.user.id, serviceType: 'ugc_fal', status: 'active' },
        }),
        { label: 'MoGraph-Status-UgcKey' }
      )
      if (ugcFalKey) {
        falKey = ugcFalKey.apiKey.trim()
      }
    }

    if (!falKey) {
      falKey = process.env.FAL_KEY || null
    }

    if (!falKey) {
      return NextResponse.json({ error: 'No fal.ai API key' }, { status: 400 })
    }

    // Build status URL
    const endpoint = model ? `fal-ai/${model}` : 'fal-ai/veo3.1/image-to-video'
    const checkStatusUrl = statusUrl || `https://queue.fal.run/${endpoint}/requests/${requestId}/status`
    const checkResponseUrl = responseUrl || `https://queue.fal.run/${endpoint}/requests/${requestId}`

    // Check status
    const statusRes = await fetch(checkStatusUrl, {
      headers: { 'Authorization': `Key ${falKey}` },
    })

    const statusData = await statusRes.json().catch(() => null)
    console.log('[MotionGraphics-Status]', requestId, '—', statusData?.status)

    if (!statusRes.ok) {
      return NextResponse.json(
        { error: `Status check failed: HTTP ${statusRes.status}` },
        { status: 500 }
      )
    }

    // If completed, fetch the result
    if (statusData?.status === 'COMPLETED') {
      const resultRes = await fetch(checkResponseUrl, {
        headers: { 'Authorization': `Key ${falKey}` },
      })
      const resultData = await resultRes.json().catch(() => null)

      // Robust video URL extraction — different fal.ai models return different shapes
      const videoUrl =
        resultData?.video?.url                          // { video: { url } } — Kling, Seedance, Veo
        || resultData?.output?.video?.url               // { output: { video: { url } } }
        || resultData?.video_url                        // { video_url } — some Kling variants
        || resultData?.output?.video_url                // { output: { video_url } }
        || (typeof resultData?.video === 'string' ? resultData.video : null)  // { video: "url" }
        || (typeof resultData?.output === 'string' ? resultData.output : null) // { output: "url" }
        || resultData?.result?.video?.url               // { result: { video: { url } } }
        || resultData?.data?.video?.url                 // { data: { video: { url } } }
        || null

      // Handle content rejection — Veo 3.1 may return { detail: "..." } with no media
      if (!videoUrl) {
        console.error('[MotionGraphics-Status] COMPLETED but video URL not found! Full response keys:', JSON.stringify(Object.keys(resultData || {})))
        console.error('[MotionGraphics-Status] Full response (truncated):', JSON.stringify(resultData)?.substring(0, 500))

        // Check if this is a content/prompt rejection from the model
        const detail = resultData?.detail
        const isContentRejection = typeof detail === 'string' && (
          detail.includes('did not generate') ||
          detail.includes('unsafe content') ||
          detail.includes('incompatible') ||
          detail.includes('no_media_generated') ||
          detail.includes('blocked') ||
          detail.includes('policy')
        )

        // Mark the asset as failed
        try {
          const assets: any = await withDbRetry(
            () => prisma.creativeAsset.findMany({
              where: { userId: session.user.id, format: 'motion-graphic', status: 'processing' },
              orderBy: { createdAt: 'desc' },
              take: 5,
            }),
            { label: 'MoGraph-Status-AssetFail' }
          )
          const matchingAsset = assets.find(a => {
            try { return JSON.parse(a.metadata || '{}').requestId === requestId } catch { return false }
          })
          if (matchingAsset) {
            await prisma.creativeAsset.update({
              where: { id: matchingAsset.id },
              data: { status: 'error' },
            }).catch(() => {})
          }
        } catch (e) { console.warn('[MoGraph-Status] Asset fail-mark error:', e) }

        if (isContentRejection) {
          return NextResponse.json({
            status: 'CONTENT_REJECTED',
            error: 'El modelo rechazó el prompt. Puede ser por contenido incompatible o restricciones de seguridad del modelo. Intenta reformular tu descripción.',
            errorDetail: detail,
            requestId,
          })
        }

        // Unknown completion without video — return as failed
        return NextResponse.json({
          status: 'FAILED',
          error: 'El video se procesó pero no se generó ningún archivo. Intenta de nuevo con un prompt diferente.',
          errorDetail: detail || 'No video URL in response',
          requestId,
        })
      }

      console.log('[MotionGraphics-Status] Completed — video:', videoUrl?.substring(0, 80))

      // Update creative asset if exists
      try {
        const assets: any[] = await withDbRetry(
          () => prisma.creativeAsset.findMany({
            where: { userId: session.user.id, format: 'motion-graphic', status: 'processing' },
            orderBy: { createdAt: 'desc' },
            take: 5,
          }),
          { label: 'MoGraph-Status-AssetOk' }
        ) as any[]
        const matchingAsset = assets.find((a: any) => {
          try { return JSON.parse(a.metadata || '{}').requestId === requestId } catch { return false }
        })
        if (matchingAsset) {
          await prisma.creativeAsset.update({
            where: { id: matchingAsset.id },
            data: { content: videoUrl, status: 'ready' },
          })
        }
      } catch (e) {
        console.warn('[MotionGraphics-Status] Asset update error:', e)
      }

      return NextResponse.json({
        status: 'COMPLETED',
        videoUrl,
        requestId,
      })
    }

    if (statusData?.status === 'FAILED') {
      return NextResponse.json({
        status: 'FAILED',
        error: statusData?.error || 'Generation failed',
        requestId,
      })
    }

    // Still processing
    return NextResponse.json({
      status: statusData?.status || 'IN_PROGRESS',
      requestId,
      queuePosition: statusData?.queue_position,
    })
  } catch (error) {
    console.error('[MotionGraphics-Status] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
