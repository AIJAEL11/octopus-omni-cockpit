export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'
import { decryptApiKey } from '@/lib/crypto'
import { callLLM } from '@/lib/turbo-llm'
import { ELITE_CREATIVE_DIRECTOR_SYSTEM } from '@/lib/elite-creative-director'

// Image-to-video models for Motion Graphics
const MOGRAPH_MODELS: Record<string, {
  endpoint: string
  label: string
  provider: string
  supportsEndFrame?: boolean
  supportsAudio?: boolean
  defaultDuration?: string
}> = {
  // --- Google ---
  'veo-3.1': {
    endpoint: 'fal-ai/veo3.1/image-to-video',
    label: 'Veo 3.1',
    provider: 'Google',
    supportsAudio: true,
    defaultDuration: '6',
  },
  'veo-3.1-first-last': {
    endpoint: 'fal-ai/veo3.1/fast/first-last-frame-to-video',
    label: 'Veo 3.1 Start+End',
    provider: 'Google',
    supportsEndFrame: true,
    supportsAudio: true,
    defaultDuration: '6',
  },
  // --- OpenAI ---
  'sora-2-pro': {
    endpoint: 'fal-ai/sora-2/image-to-video/pro',
    label: 'Sora 2 Pro',
    provider: 'OpenAI',
    supportsAudio: true,
    defaultDuration: '5',
  },
  // --- Kuaishou (Kling) ---
  'kling-3.0-pro': {
    endpoint: 'fal-ai/kling-video/v3/pro/image-to-video',
    label: 'Kling 3.0 Pro',
    provider: 'Kuaishou',
    supportsAudio: true,
    defaultDuration: '5',
  },
  'kling-2.6-pro': {
    endpoint: 'fal-ai/kling-video/v2.6/pro/image-to-video',
    label: 'Kling 2.6 Pro',
    provider: 'Kuaishou',
    defaultDuration: '5',
  },
  'kling-2.5-turbo': {
    endpoint: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
    label: 'Kling 2.5 Turbo',
    provider: 'Kuaishou',
    defaultDuration: '5',
  },
  'kling-2.1-pro': {
    endpoint: 'fal-ai/kling-video/v2.1/pro/image-to-video',
    label: 'Kling 2.1 Pro',
    provider: 'Kuaishou',
    defaultDuration: '5',
  },
  // --- ByteDance (Seedance) ---
  'seedance-1.5': {
    endpoint: 'fal-ai/bytedance/seedance/v1.5/pro/image-to-video',
    label: 'Seedance 1.5 Pro',
    provider: 'ByteDance',
    supportsAudio: true,
    supportsEndFrame: true,
    defaultDuration: '5',
  },
  // --- MiniMax (Hailuo) ---
  'hailuo-2.3': {
    endpoint: 'fal-ai/minimax/hailuo-2.3-fast/standard/image-to-video',
    label: 'Hailuo 2.3 Fast',
    provider: 'MiniMax',
    defaultDuration: '6',
  },
  'hailuo-02': {
    endpoint: 'fal-ai/minimax/hailuo-02/standard/image-to-video',
    label: 'Hailuo-02',
    provider: 'MiniMax',
    defaultDuration: '6',
  },
  // --- Alibaba (Wan) ---
  'wan-2.7': {
    endpoint: 'fal-ai/wan/v2.7/image-to-video',
    label: 'Wan 2.7',
    provider: 'Alibaba',
    defaultDuration: '5',
  },
  // --- PixVerse ---
  'pixverse-5.6': {
    endpoint: 'fal-ai/pixverse/v5.6/image-to-video',
    label: 'PixVerse v5.6',
    provider: 'PixVerse',
    defaultDuration: '5',
  },
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      imageUrl,
      endFrameUrl,
      rawPrompt,
      model,
      duration,
      aspectRatio,
      generateAudio,
      language,
      enhanceOnly,
      skipRefine,
      emotion,
      template,
    } = await request.json()

    if (!rawPrompt) {
      return NextResponse.json(
        { error: 'rawPrompt is required' },
        { status: 400 }
      )
    }

    // --- Enhance-only mode: just refine the prompt and return, no video generation ---
    if (enhanceOnly) {
      const lang = language || 'es'
      try {
        const systemMsg = `${ELITE_CREATIVE_DIRECTOR_SYSTEM}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MOTION GRAPHICS PROMPT ENHANCER (operates under Elite Director DNA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Take the user's basic description and transform it into an EXPENSIVE,
cinematic, technically precise video generation prompt (<200 words).

MANDATORY structure embedded in the output (labeled inline when possible):
  [HOOK 0-2s] → aggressive scroll-stopper frame/motion
  [CONTRAST]  → pain state → relief state (temporal, split-screen, or symbolic)
  [CINEMATIC DIRECTION] → camera (lens, movement, angle), lighting (direction + quality),
                          rhythm (cuts/second, beats, ramps), color palette (2-3 hex/named).

Run the Quality Auto-Check silently before returning. If it reads
"cheap AI startup", rewrite until it reads "Apple × A24".

Output in ENGLISH only (video models don't understand other languages).
No markdown. Pure prompt text, ready to ship.`
        const llmResponse = await callLLM(session.user.id, [
          { role: 'system', content: systemMsg },
          { role: 'user', content: `User description: "${rawPrompt}"\n\nGenerate the enhanced motion graphic prompt:` },
        ], { model: 'gpt-4.1', maxTokens: 500, temperature: 0.7 })
        const llmText = llmResponse.choices?.[0]?.message?.content
        return NextResponse.json({ refinedPrompt: llmText?.trim() || rawPrompt })
      } catch (err) {
        console.warn('[MotionGraphics] Enhance-only failed:', err)
        return NextResponse.json({ refinedPrompt: rawPrompt })
      }
    }

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl is required' },
        { status: 400 }
      )
    }

    // Resolve model
    const modelId = model && MOGRAPH_MODELS[model] ? model : 'veo-3.1'
    const modelConfig = MOGRAPH_MODELS[modelId]

    // If end frame provided but model doesn't support it, auto-switch
    const effectiveModelId = endFrameUrl && !modelConfig.supportsEndFrame
      ? 'veo-3.1-first-last'
      : modelId
    const effectiveConfig = MOGRAPH_MODELS[effectiveModelId]

    // Step 1: Refine prompt with LLM → professional motion graphic prompt
    const lang = language || 'es'
    let refinedPrompt = rawPrompt

    // Skip refinement if user already enhanced the prompt via AI Enhancer
    if (skipRefine) {
      refinedPrompt = rawPrompt
      console.log('[MotionGraphics] Skipping refinement (pre-enhanced prompt)')
    } else try {
      const systemMsg = `${ELITE_CREATIVE_DIRECTOR_SYSTEM}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MOTION GRAPHICS PROMPT BUILDER (operates under Elite Director DNA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Take the user's short description and build a professional, cinematic
motion-graphic video generation prompt (<200 words).

MANDATORY structure embedded in the output:
  [HOOK 0-2s] → aggressive scroll-stopper (extreme close-up, whip-pan,
                pattern interrupt, not a slow fade)
  [CONTRAST]  → pain → relief (can be symbolic: gray→vibrant; temporal:
                before→after; spatial: split-screen)
  [CINEMATIC DIRECTION] → lens (35mm, 85mm macro), camera move (dolly-in,
                orbital, handheld, locked-off), lighting (soft north-window,
                hard rim, neon practicals, golden hour), rhythm (cuts/sec,
                slow-mo bursts, beat sync, freeze-frames), color palette
                (2-3 hex or named + grade), animation craft (easing, timing,
                bouncing, scaling, sliding, rotating).

Run the Quality Auto-Check silently before returning: would this stop
the scroll on TikTok? Does it feel Apple × A24 premium? If weak → rewrite.

Output in ENGLISH only (video models don't understand other languages).
No markdown. Pure prompt text, ready to ship.`

      const llmResponse = await callLLM(session.user.id, [
        { role: 'system', content: systemMsg },
        { role: 'user', content: `User description: "${rawPrompt}"\n\nGenerate the motion graphic prompt:` },
      ], { model: 'gpt-4.1', maxTokens: 500, temperature: 0.7 })

      const llmText = llmResponse.choices?.[0]?.message?.content
      if (llmText && llmText.length > 20) {
        refinedPrompt = llmText.trim()
      }
      console.log('[MotionGraphics] Refined prompt:', refinedPrompt.substring(0, 100))
    } catch (llmErr) {
      console.warn('[MotionGraphics] LLM prompt refinement failed, using raw:', llmErr)
    }

    // Step 2: Get fal.ai API key (with retry for connection pool resilience)
    let falKey: string | null = null

    // Try user's key from API Hub (serviceType: 'falai')
    const userApiKey: any = await withDbRetry(
      () => prisma.apiKey.findFirst({
        where: { userId: session.user.id, serviceType: 'falai', status: 'active' },
      }),
      { label: 'MoGraph-FalKey' }
    )
    if (userApiKey) {
      falKey = decryptApiKey(userApiKey.apiKey)
      await prisma.apiKey.update({
        where: { id: userApiKey.id },
        data: { lastUsed: new Date(), usageCount: { increment: 1 } },
      }).catch(() => {})
    }

    // Try UGC fal key as fallback
    if (!falKey) {
      const ugcFalKey: any = await withDbRetry(
        () => prisma.apiKey.findFirst({
          where: { userId: session.user.id, serviceType: 'ugc_fal', status: 'active' },
        }),
        { label: 'MoGraph-UgcKey' }
      )
      if (ugcFalKey) {
        falKey = ugcFalKey.apiKey.trim()
        await prisma.apiKey.update({
          where: { id: ugcFalKey.id },
          data: { lastUsed: new Date(), usageCount: { increment: 1 } },
        }).catch(() => {})
      }
    }

    // Fallback to server key
    if (!falKey) {
      falKey = process.env.FAL_KEY || null
    }

    if (!falKey) {
      return NextResponse.json(
        { error: lang === 'es'
          ? 'No tienes una API key de fal.ai configurada. Ve a API Hub para agregar tu key.'
          : 'No fal.ai API key configured. Go to API Hub to add your key.' },
        { status: 400 }
      )
    }

    // Step 3: Build fal.ai payload
    const endpoint = effectiveConfig.endpoint
    const isFirstLastFrame = effectiveModelId.includes('first-last') || endpoint.includes('first-last')
    const durationStr = (() => {
      const d = String(duration || effectiveConfig.defaultDuration || '5')
      return d.endsWith('s') ? d : `${d}s`
    })()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = {
      prompt: refinedPrompt,
      duration: durationStr,
      aspect_ratio: aspectRatio || '16:9',
      negative_prompt: 'blur, distort, low quality, watermark, text overlay, glitch',
      generate_audio: generateAudio !== false && (effectiveConfig.supportsAudio || false),
    }

    // Set the correct image parameter based on endpoint type
    if (isFirstLastFrame) {
      // Veo 3.1 first-last-frame endpoint requires first_frame_url + last_frame_url
      payload.first_frame_url = imageUrl
      if (endFrameUrl) {
        payload.last_frame_url = endFrameUrl
      }
      console.log(`[Octopus] Multi-frame handshake ready — first_frame: ${imageUrl?.substring(0, 60)}..., last_frame: ${endFrameUrl ? endFrameUrl.substring(0, 60) + '...' : 'none'}`)
    } else {
      // Standard single-frame endpoint uses image_url
      payload.image_url = imageUrl

      // Add end frame if supported by other models
      if (endFrameUrl && effectiveConfig.supportsEndFrame) {
        if (effectiveModelId.includes('seedance')) {
          payload.end_image_url = endFrameUrl
        }
      } else if (endFrameUrl && effectiveModelId.includes('kling')) {
        payload.tail_image_url = endFrameUrl
      }
    }

    // Kling-specific
    if (effectiveModelId.includes('kling')) {
      payload.cfg_scale = 0.5
      if (!effectiveConfig.supportsAudio) delete payload.generate_audio
    }

    // Hailuo/MiniMax-specific
    if (effectiveModelId.includes('hailuo')) {
      payload.prompt_optimizer = true
      delete payload.negative_prompt
      delete payload.generate_audio
    }

    // Wan-specific
    if (effectiveModelId.includes('wan')) {
      delete payload.generate_audio
      delete payload.negative_prompt
    }

    // PixVerse-specific
    if (effectiveModelId.includes('pixverse')) {
      delete payload.generate_audio
      delete payload.negative_prompt
    }

    // Sora-specific
    if (effectiveModelId.includes('sora')) {
      delete payload.negative_prompt
    }

    console.log(`[MotionGraphics] Submitting to ${effectiveConfig.label} (${endpoint}) — duration: ${payload.duration}, aspect: ${payload.aspect_ratio}, multiFrame: ${isFirstLastFrame}`)

    // Step 4: Submit to fal.ai queue
    const response = await fetch(`https://queue.fal.run/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${falKey}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json().catch(() => null)
    console.log('[MotionGraphics] Queue response:', response.status, 'request_id:', data?.request_id)

    if (!response.ok || !data?.request_id) {
      const errMsg = data?.detail || data?.error || data?.message || `HTTP ${response.status}`
      console.error('[MotionGraphics] fal.ai error:', errMsg, JSON.stringify(data))

      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { error: lang === 'es' ? 'API key de fal.ai inválida o expirada.' : 'Invalid or expired fal.ai API key.' },
          { status: 401 }
        )
      }
      return NextResponse.json({ error: `fal.ai error: ${errMsg}` }, { status: 500 })
    }

    // Save to creative assets as "processing"
    await prisma.creativeAsset.create({
      data: {
        userId: session.user.id,
        type: 'video',
        title: `Motion Graphic — ${effectiveConfig.label}`,
        prompt: refinedPrompt,
        content: '', // Will be updated when complete
        platform: 'general',
        format: 'motion-graphic',
        status: 'processing',
        tags: 'motion-graphics',
        metadata: JSON.stringify({
          source: 'motion-graphics',
          model: effectiveModelId,
          requestId: data.request_id,
          startFrame: imageUrl,
          endFrame: endFrameUrl || null,
          rawPrompt,
          emotion: emotion || null,
          template: template || null,
        }),
      },
    }).catch(e => console.warn('[MotionGraphics] Asset save error:', e))

    return NextResponse.json({
      success: true,
      requestId: data.request_id,
      statusUrl: data.status_url || null,
      responseUrl: data.response_url || null,
      status: data.status || 'IN_QUEUE',
      model: effectiveModelId,
      modelLabel: effectiveConfig.label,
      refinedPrompt,
    })
  } catch (error) {
    console.error('[MotionGraphics] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET: Return available models
export async function GET() {
  const models = Object.entries(MOGRAPH_MODELS).map(([id, config]) => ({
    id,
    label: config.label,
    supportsEndFrame: config.supportsEndFrame || false,
    supportsAudio: config.supportsAudio || false,
    defaultDuration: config.defaultDuration || '5',
  }))
  return NextResponse.json({ models })
}
