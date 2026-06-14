/**
 * Sprint 12 v4: Async Image Generation with Job Queue + Polling
 * 
 * POST /api/arms/claude-code/image-gen  — Submit job, returns jobId immediately (<500ms)
 * GET  /api/arms/claude-code/image-gen  — Poll job status by jobId (<100ms)
 * 
 * The actual image generation runs in the background (fire-and-forget).
 * This architecture is IMMUNE to Cloudflare 524 timeouts and HTTP2 errors
 * because no request ever blocks for more than a few hundred milliseconds.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getImageModel } from '@/lib/image-models'
import { FALLBACK_CHAIN, getModelDisplayName, getNextFallback } from '@/lib/image-model-router'
import { uploadBufferToS3Public } from '@/lib/s3'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ═══════════════════════════════════════════════════════════════════════════════
interface ImageGenRequest {
  prompt: string
  model?: string
  path?: string
  aspect_ratio?: string
  style?: string
  userId?: string
  sessionId?: string
  messageId?: string
}

// Extract image URL from OpenAI-compatible response
function extractImageUrl(data: Record<string, unknown>): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any

  // ── 1. OpenAI / OpenRouter chat completions: choices[0].message ──
  const msg = d.choices?.[0]?.message
  if (msg) {
    if (typeof msg.image_url === 'string') return msg.image_url
    if (msg.image_url?.url) return msg.image_url.url
    if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === 'image_url' && part.image_url?.url) return part.image_url.url
        if (part.type === 'image' && part.url) return part.url
        if (part.type === 'image' && part.source?.type === 'base64') {
          return `data:image/${part.source.media_type?.split('/')[1] || 'png'};base64,${part.source.data}`
        }
        // Some models put URL directly in content part
        if (typeof part === 'string' && (part.startsWith('http') || part.startsWith('data:image/'))) return part
      }
    }
    if (typeof msg.content === 'string') {
      if (msg.content.startsWith('data:image/')) return msg.content
      const mdMatch = msg.content.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/)
      if (mdMatch) return mdMatch[1]
      const urlMatch = msg.content.match(/(https?:\/\/\S+\.(?:png|jpg|jpeg|webp|gif|svg)(?:\?[^\s)]*)?)/i)
      if (urlMatch) return urlMatch[1]
    }
    // Some APIs put image as tool_calls or function_call result
    if (msg.tool_calls?.[0]?.function?.arguments) {
      try {
        const args = JSON.parse(msg.tool_calls[0].function.arguments)
        if (args.url) return args.url
        if (args.image_url) return args.image_url
      } catch { /* ignore */ }
    }
  }

  // ── 2. DALL-E / Images API format: data[0].url or data[0].b64_json ──
  if (Array.isArray(d.data)) {
    for (const item of d.data) {
      if (typeof item.url === 'string') return item.url
      if (typeof item.b64_json === 'string') return `data:image/png;base64,${item.b64_json}`
      if (typeof item.revised_prompt === 'undefined' && typeof item === 'string') {
        if (item.startsWith('http') || item.startsWith('data:image/')) return item
      }
    }
  }

  // ── 3. Artifacts format (some Stability / FAL models) ──
  if (Array.isArray(d.artifacts)) {
    for (const art of d.artifacts) {
      if (art.url) return art.url
      if (art.base64) return `data:image/${art.type || 'png'};base64,${art.base64}`
    }
  }

  // ── 4. Direct output field (some flux models) ──
  if (d.output?.url) return d.output.url
  if (typeof d.output === 'string' && (d.output.startsWith('http') || d.output.startsWith('data:image/'))) return d.output
  if (Array.isArray(d.output)) {
    for (const item of d.output) {
      if (typeof item === 'string' && (item.startsWith('http') || item.startsWith('data:image/'))) return item
      if (item?.url) return item.url
    }
  }

  // ── 5. images[] array (some newer APIs) ──
  if (Array.isArray(d.images)) {
    for (const img of d.images) {
      if (typeof img === 'string') return img
      if (img?.url) return img.url
      if (img?.b64_json) return `data:image/png;base64,${img.b64_json}`
    }
  }

  // ── 6. image field directly ──
  if (typeof d.image === 'string') return d.image
  if (d.image?.url) return d.image.url

  // ── 7. result field ──
  if (d.result?.url) return d.result.url
  if (typeof d.result === 'string' && d.result.startsWith('http')) return d.result

  // ── 8. Deep scan: walk top-level for any URL-looking string ──
  const json = JSON.stringify(d)
  const deepUrl = json.match(/"(https?:\/\/[^"]+\.(?:png|jpg|jpeg|webp|gif)(?:\?[^"]*)?)"/)
  if (deepUrl) return deepUrl[1]
  // Check for base64 in response
  const b64Match = json.match(/"(data:image\/[^"]+)"/)
  if (b64Match) return b64Match[1]

  return null
}

// Persist base64 data URIs to S3
async function persistIfDataUri(url: string): Promise<string> {
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  const match = url.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!match) return url
  try {
    const ext = match[1]
    const base64Data = match[2]
    const buffer = Buffer.from(base64Data, 'base64')
    const fileName = `ce-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { publicUrl } = await uploadBufferToS3Public(buffer, fileName, `image/${ext}`)
    console.log(`[ImageGen] base64 (${buffer.length} bytes) → S3: ${publicUrl}`)
    return publicUrl
  } catch (err) {
    console.error('[ImageGen] S3 upload failed:', err)
    return url
  }
}

// Call image generation API for a specific model
async function callImageAPI(
  prompt: string,
  modelId: string,
  aspectRatio: string | undefined,
  apiKey: string | null,
): Promise<{ url: string; modelUsed: string } | null> {
  const modelMeta = getImageModel(modelId)
  const kind = modelMeta?.kind ?? 'image-only'
  const supportsImageConfig = (modelMeta?.supportsAspectRatio ?? false) || (modelMeta?.supportsImageSize ?? false)
  const isDefault = modelId === 'default' || !apiKey

  let apiUrl: string
  let apiHeaders: Record<string, string>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let apiBody: Record<string, any>
  let label: string

  if (!isDefault && modelId !== 'default') {
    apiUrl = 'https://openrouter.ai/api/v1/chat/completions'
    apiHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://octopus.app',
      'X-Title': 'OCTOPUS Code Engine',
    }
    apiBody = {
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      modalities: kind === 'chat-image' ? ['image', 'text'] : ['image'],
    }
    if (supportsImageConfig) {
      apiBody.image_config = { aspect_ratio: aspectRatio || '1:1' }
    }
    label = getModelDisplayName(modelId)
  } else {
    apiUrl = 'https://routellm.abacus.ai/v1/chat/completions'
    apiHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
    }
    apiBody = {
      model: 'route-llm',
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image'],
    }
    label = '🤖 RouteLLM'
  }

  console.log(`[ImageGen] Calling ${label} — ${apiUrl}`)
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 300_000) // 5 min — GPT-5.4-image-2 takes 200-230s
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify(apiBody),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      console.error(`[ImageGen] ${label} failed (${response.status}): ${errBody.substring(0, 300)}`)
      return null
    }
    const data = await response.json()
    // Log response structure for debugging (first 800 chars)
    const responsePreview = JSON.stringify(data).substring(0, 800)
    console.log(`[ImageGen] ${label} response keys: ${Object.keys(data).join(',')}`)
    console.log(`[ImageGen] ${label} response preview: ${responsePreview}`)
    const imageUrl = extractImageUrl(data)
    if (!imageUrl) {
      console.error(`[ImageGen] ${label} returned no image URL — full keys: ${JSON.stringify(Object.keys(data))}`)
      return null
    }
    console.log(`[ImageGen] ✅ ${label} extracted URL: ${imageUrl.substring(0, 120)}...`)
    const finalUrl = await persistIfDataUri(imageUrl)
    return { url: finalUrl, modelUsed: label }
  } catch (err) {
    const isTimeout = err instanceof DOMException && err.name === 'AbortError'
    console.error(`[ImageGen] ${label} ${isTimeout ? 'TIMEOUT (300s)' : 'error'}:`, err)
    return null
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main generation function with fallback chain
// ═══════════════════════════════════════════════════════════════════════════════
async function generateImageWithFallback(
  prompt: string,
  modelId: string,
  aspectRatio: string | undefined,
  userId: string,
): Promise<{ url: string; modelUsed: string; modelEmoji: string; prompt: string; path: string; fallbackUsed: boolean; error?: string }> {
  let apiKey: string | null = null
  try {
    const record = await prisma.apiKey.findFirst({
      where: { userId, serviceType: { startsWith: 'turbo_' }, status: 'active' },
    })
    apiKey = record?.apiKey?.trim() || null
    if (record) {
      prisma.apiKey.update({
        where: { id: record.id },
        data: { lastUsed: new Date(), usageCount: { increment: 1 } },
      }).catch(() => {})
    }
  } catch {}

  const safeName = prompt.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '-').substring(0, 40) || 'generated'
  const defaultPath = `assets/images/${safeName}-${Date.now().toString(36)}.png`

  // Try primary model
  const primaryResult = await callImageAPI(prompt, modelId, aspectRatio, apiKey)
  if (primaryResult) {
    return {
      url: primaryResult.url, modelUsed: primaryResult.modelUsed,
      modelEmoji: getImageModel(modelId)?.emoji || '🎨',
      prompt, path: defaultPath, fallbackUsed: false,
    }
  }

  // Fallback chain
  console.log(`[ImageGen] Primary model failed (${modelId}), trying fallback chain...`)
  let nextModel = getNextFallback(modelId)
  while (nextModel) {
    const fallbackResult = await callImageAPI(prompt, nextModel, aspectRatio, apiKey)
    if (fallbackResult) {
      return {
        url: fallbackResult.url, modelUsed: fallbackResult.modelUsed,
        modelEmoji: getImageModel(nextModel)?.emoji || '🎨',
        prompt, path: defaultPath, fallbackUsed: true,
      }
    }
    nextModel = getNextFallback(nextModel)
  }

  // Ultimate fallback: RouteLLM
  const routeLLMResult = await callImageAPI(prompt, 'default', aspectRatio, null)
  if (routeLLMResult) {
    return {
      url: routeLLMResult.url, modelUsed: routeLLMResult.modelUsed,
      modelEmoji: '🤖', prompt, path: defaultPath, fallbackUsed: true,
    }
  }

  return {
    url: '', modelUsed: 'none', modelEmoji: '❌',
    prompt, path: defaultPath, fallbackUsed: true,
    error: 'All image generation models failed. Please try again.',
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Background worker: generates image, updates BridgeCommand when done
// This runs AFTER the POST response has already been sent (fire-and-forget)
// ═══════════════════════════════════════════════════════════════════════════════
async function processImageJobInBackground(
  jobId: string,
  prompt: string,
  modelId: string,
  aspectRatio: string | undefined,
  userId: string,
  savePath: string,
  sessionId: string,
  messageId: string | null,
) {
  const startTime = Date.now()
  console.log(`[ImageGen:BG] 🚀 Starting job ${jobId.slice(0, 8)} — "${prompt.slice(0, 50)}"...`)
  try {
    console.log(`[ImageGen:BG] Job ${jobId.slice(0, 8)} calling generateImageWithFallback...`)
    const result = await generateImageWithFallback(prompt, modelId, aspectRatio, userId)
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[ImageGen:BG] Job ${jobId.slice(0, 8)} generateImageWithFallback returned after ${elapsed}s — url=${result.url ? 'YES' : 'NO'}, error=${result.error || 'none'}`)

    if (result.error || !result.url) {
      // Mark job as failed
      console.log(`[ImageGen:BG] Job ${jobId.slice(0, 8)} → updating DB to 'failed'...`)
      await prisma.bridgeCommand.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          payload: JSON.stringify({
            action: 'save_image', path: savePath, url: '',
            prompt, error: result.error || 'No image URL generated',
            modelUsed: result.modelUsed, modelEmoji: result.modelEmoji,
          }),
        },
      })
      console.error(`[ImageGen:BG] Job ${jobId.slice(0, 8)} FAILED (DB updated): ${result.error}`)
      return
    }

    // Success — update the BridgeCommand with the real URL and mark ready for Bridge
    console.log(`[ImageGen:BG] Job ${jobId.slice(0, 8)} → updating DB to 'approved' with URL: ${result.url.substring(0, 80)}...`)
    await prisma.bridgeCommand.update({
      where: { id: jobId },
      data: {
        status: 'approved',
        payload: JSON.stringify({
          action: 'save_image', path: savePath,
          url: result.url, prompt,
          modelUsed: result.modelUsed, modelEmoji: result.modelEmoji,
          fallbackUsed: result.fallbackUsed,
        }),
      },
    })
    console.log(`[ImageGen:BG] ✅ Job ${jobId.slice(0, 8)} COMPLETED in ${elapsed}s: ${result.modelUsed} → ${savePath}`)
  } catch (bgErr) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.error(`[ImageGen:BG] ❌ Job ${jobId.slice(0, 8)} CRASH after ${elapsed}s:`, bgErr)
    try {
      await prisma.bridgeCommand.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          payload: JSON.stringify({
            action: 'save_image', path: savePath, url: '', prompt,
            error: bgErr instanceof Error ? bgErr.message : 'Background processing crashed',
          }),
        },
      })
      console.log(`[ImageGen:BG] Job ${jobId.slice(0, 8)} crash status written to DB`)
    } catch (dbErr) {
      console.error(`[ImageGen:BG] Job ${jobId.slice(0, 8)} DOUBLE FAILURE — could not update DB:`, dbErr)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST — Submit an image generation job (returns in <500ms)
// ═══════════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: ImageGenRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.prompt || typeof body.prompt !== 'string') {
    return NextResponse.json({ error: 'prompt required' }, { status: 400 })
  }

  const modelId = body.model || 'google/gemini-3.1-flash-image-preview' // Nano Banana: fast (~10s) vs GPT-5.4 (~230s)
  const safeName = body.prompt.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '-').substring(0, 40) || 'generated'
  const savePath = body.path || `assets/images/${safeName}-${Date.now().toString(36)}.png`
  const sessionId = body.sessionId || ''
  const messageId = body.messageId || null

  // Create BridgeCommand with status 'generating' — this is the "job ticket"
  let jobId: string
  try {
    const job = await prisma.bridgeCommand.create({
      data: {
        sessionId: sessionId || 'orphan-' + Date.now(),
        messageId,
        type: 'save_image',
        payload: JSON.stringify({
          action: 'save_image', path: savePath, url: '',
          prompt: body.prompt, model: modelId, status: 'generating',
        }),
        status: 'generating',  // Bridge ignores this — only picks up 'approved'
        requiresConfirmation: false,
      },
    })
    jobId = job.id
  } catch (dbErr) {
    console.error('[ImageGen] Failed to create job:', dbErr)
    return NextResponse.json({ error: 'Failed to create image job' }, { status: 500 })
  }

  // Fire and forget — do NOT await
  processImageJobInBackground(
    jobId, body.prompt, modelId, body.aspect_ratio, body.userId || session.user.id,
    savePath, sessionId, messageId,
  ).catch(err => console.error('[ImageGen:BG] Unhandled:', err))

  // Return immediately with the job ticket
  console.log(`[ImageGen] Job ${jobId.slice(0, 8)} created for "${body.prompt.slice(0, 50)}" — responding immediately`)
  return NextResponse.json({
    jobId,
    status: 'generating',
    path: savePath,
    model: modelId,
    prompt: body.prompt,
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET — Poll job status (returns in <100ms)
// ═══════════════════════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jobId = req.nextUrl.searchParams.get('jobId')
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 })
  }

  try {
    const job = await prisma.bridgeCommand.findUnique({
      where: { id: jobId },
      select: { id: true, status: true, payload: true, createdAt: true },
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Safety timeout: if job is still 'generating' after 8 minutes, mark it failed
    // Primary model (GPT-5.4) can take 200-230s, plus fallback chain adds more time
    const ageMs = Date.now() - new Date(job.createdAt).getTime()
    if (job.status === 'generating' && ageMs > 8 * 60 * 1000) {
      console.error(`[ImageGen:Poll] Job ${jobId.slice(0, 8)} stuck in 'generating' for ${Math.round(ageMs / 1000)}s — marking failed`)
      await prisma.bridgeCommand.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          payload: JSON.stringify({
            action: 'save_image', path: '', url: '',
            error: `Job timed out after ${Math.round(ageMs / 1000)}s — background worker may have crashed`,
          }),
        },
      }).catch(e => console.error('[ImageGen:Poll] Failed to update stuck job:', e))
      return NextResponse.json({
        jobId: job.id,
        status: 'failed',
        url: '',
        path: '',
        modelUsed: '',
        modelEmoji: '',
        error: 'Generation timed out on server',
        fallbackUsed: false,
        createdAt: job.createdAt,
      })
    }

    // Parse payload for details
    let payload: Record<string, unknown> = {}
    try { payload = JSON.parse(job.payload as string) } catch {}

    // ── Defense in depth: if Bridge overwrote status to 'failed' but the image
    // was actually generated (URL exists in payload), report as 'approved'.
    // The image-gen pipeline is the source of truth for generation success.
    const hasValidUrl = typeof payload.url === 'string' && (payload.url as string).startsWith('http')
    const hasGenError = typeof payload.error === 'string' && (payload.error as string).length > 0
    const effectiveStatus = (job.status === 'failed' && hasValidUrl && !hasGenError) ? 'approved' : job.status
    if (effectiveStatus !== job.status) {
      console.log(`[ImageGen:Poll] Job ${jobId.slice(0, 8)} — overriding DB status '${job.status}' → '${effectiveStatus}' (URL exists, no gen error)`)
      // Also fix the DB so fetchCommands() sees the correct status for gallery/thumbnails
      prisma.bridgeCommand.update({
        where: { id: jobId },
        data: { status: effectiveStatus },
      }).catch(e => console.error(`[ImageGen:Poll] Failed to fix DB status for ${jobId.slice(0, 8)}:`, e))
    }

    return NextResponse.json({
      jobId: job.id,
      status: effectiveStatus, // 'generating' | 'approved' (= completed) | 'failed'
      url: payload.url || '',
      path: payload.path || '',
      modelUsed: payload.modelUsed || '',
      modelEmoji: payload.modelEmoji || '',
      error: payload.error || null,
      fallbackUsed: payload.fallbackUsed || false,
      createdAt: job.createdAt,
    })
  } catch (dbErr) {
    console.error('[ImageGen:Poll] DB error:', dbErr)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
